import { EventEmitter } from 'events';
import { BackoffOpts } from '../../interfaces/queue-hub-job-opts.interface';
import { QueueHubJob } from '../../interfaces/queue-hub-job.interface';
import {
  QueueHubWorker,
  QueueHubWorkerListener,
} from '../../interfaces/queue-hub-worker.interface';
import { QueueHubLogger } from '../../utils/logger';
import { OciQueueAdapter } from './oci-queue.adapter';
import { OciQueueJobAdapter } from './oci-queue-job.adapter';

/**
 * Adapter for OCI Queue Worker implementing QueueHubWorker interface
 */
export class OciQueueWorkerAdapter extends EventEmitter implements QueueHubWorker {
  private _isRunning = false;
  private _isPaused = false;
  private pollingInterval?: NodeJS.Timeout;
  private readonly logger: QueueHubLogger;

  constructor(
    public readonly name: string,
    private readonly queue: OciQueueAdapter,
    private readonly processor: (job: QueueHubJob) => Promise<any>,
    private readonly options?: {
      concurrency?: number;
      visibilityTimeout?: number;
      pollingInterval?: number;
    },
  ) {
    super();
    this.logger = new QueueHubLogger(`OciQueueWorker:${name}`);
  }

  async close(_force?: boolean): Promise<void> {
    this._isRunning = false;
    if (this.pollingInterval) {
      clearInterval(this.pollingInterval);
    }
    this.emit('closing');
    this.emit('closed');
  }

  isRunning(): boolean {
    return this._isRunning;
  }

  isPaused(): boolean {
    return this._isPaused;
  }

  async pause(_force?: boolean): Promise<void> {
    this._isPaused = true;
  }

  async resume(): Promise<void> {
    this._isPaused = false;
  }

  private calculateBackoffDelay(backoff: number | BackoffOpts | undefined, attempt: number): number {
    if (!backoff) return 0;

    if (typeof backoff === 'number') {
      return backoff;
    }

    const { type, delay } = backoff;
    if (type === 'exponential') {
      return delay * Math.pow(2, attempt - 1);
    } else if (type === 'fixed') {
      return delay;
    }

    return delay || 0;
  }

  private async processJobWithTimeout(
    job: QueueHubJob,
    timeout?: number,
  ): Promise<any> {
    if (!timeout) {
      return this.processor(job);
    }

    return Promise.race([
      this.processor(job),
      new Promise((_, reject) =>
        setTimeout(() => {
          reject(new Error(`Job ${job.id} timed out after ${timeout}ms`));
        }, timeout),
      ),
    ]);
  }

  private sortJobsByPriority(jobs: QueueHubJob[]): QueueHubJob[] {
    return jobs.sort((a, b) => {
      const jobA = a as OciQueueJobAdapter;
      const jobB = b as OciQueueJobAdapter;
      const priorityA = jobA.getJobOpts()?.priority ?? 0;
      const priorityB = jobB.getJobOpts()?.priority ?? 0;
      // Lower priority number = higher priority
      return priorityA - priorityB;
    });
  }

  async start(): Promise<void> {
    if (this._isRunning) {
      this.logger.warn('Worker already running, skipping start');
      return;
    }

    this._isRunning = true;
    const interval = this.options?.pollingInterval || 1000;
    this.logger.debug(`Worker started, polling every ${interval}ms`);

    this.pollingInterval = setInterval(async () => {
      if (this._isPaused) {
        return;
      }

      try {
        this.logger.debug('Polling for messages...');
        const jobs = await this.queue.getMessages();

        if (jobs.length > 0) {
          this.logger.info(`Found ${jobs.length} message(s) to process`);
        }

        // Filter jobs that are ready to process (delay has passed)
        const readyJobs = jobs.filter((job) => {
          const ociJob = job as OciQueueJobAdapter;
          return ociJob.shouldProcessNow();
        });

        // Sort by priority (lower number = higher priority)
        const sortedJobs = this.sortJobsByPriority(readyJobs);

        // Apply LIFO if specified (take from end instead of beginning)
        const jobsToProcess = sortedJobs.slice(
          0,
          this.options?.concurrency || 1,
        );

        for (const job of jobsToProcess) {
          const ociJob = job as OciQueueJobAdapter;
          const jobOpts = ociJob.getJobOpts();
          const startTime = Date.now();

          // Check if job has exceeded max attempts
          if (ociJob.hasExceededMaxAttempts()) {
            this.logger.warn(
              `Job ${job.id} has exceeded max attempts (${jobOpts?.maxAttempts}), marking as failed`,
            );
            const maxAttemptsError = new Error('Max attempts exceeded');
            this.emit('failed', job, maxAttemptsError, 'waiting');
            await ociJob.moveToFailed(maxAttemptsError);
            continue;
          }

          this.logger.debug(`Starting to process job ${job.id} (attempt ${ociJob.getCurrentAttempt()})`);
          this.emit('active', job, 'waiting');

          try {
            // Process with timeout if specified
            const result = await this.processJobWithTimeout(job, jobOpts?.timeout);
            const processingTime = Date.now() - startTime;

            this.logger.debug(
              `Processor completed successfully for job ${job.id} (${processingTime}ms)`,
            );

            try {
              await job.moveToCompleted(result);
              this.emit('completed', job, result, 'active');

              const totalTime = Date.now() - startTime;
              this.logger.debug(`Job ${job.id} completed successfully (total: ${totalTime}ms)`);
            } catch (deleteError) {
              this.logger.error(
                'Failed to delete message after successful processing',
                deleteError,
              );
            }
          } catch (error) {
            const processingTime = Date.now() - startTime;
            const currentAttempt = ociJob.getCurrentAttempt();
            const maxAttempts = jobOpts?.maxAttempts;
            const errorObj = error as Error;

            this.logger.error(
              `Processor failed for job ${job.id} (attempt ${currentAttempt}/${maxAttempts || '∞'}, ${processingTime}ms)`,
              error,
            );

            // Check if we should retry
            if (maxAttempts && currentAttempt < maxAttempts) {
              const backoffDelay = this.calculateBackoffDelay(
                jobOpts?.backoff,
                currentAttempt,
              );

              ociJob.incrementAttempt();
              const nextAttempt = ociJob.getCurrentAttempt();

              if (backoffDelay > 0) {
                this.logger.debug(
                  `Scheduling retry for job ${job.id} (attempt ${nextAttempt}/${maxAttempts}) with backoff delay of ${backoffDelay}ms`,
                );

                // Re-add the job to the queue with the backoff delay
                // Remove the current message first
                await ociJob.remove();

                // Re-add with updated delay and preserve current attempt
                // We need to pass the attempt info through a custom property
                const retryOpts: any = {
                  ...ociJob.opts,
                  delay: backoffDelay,
                  attempts: maxAttempts,
                };

                // Store current attempt in a way that will be preserved
                // We'll use a custom property that the adapter can read
                (retryOpts as any)._currentAttempt = nextAttempt;

                await this.queue.add(ociJob.name, ociJob.data, retryOpts);
                this.logger.debug(`Job ${ociJob.name} re-queued with ${backoffDelay}ms delay for retry (attempt ${nextAttempt})`);
              } else {
                // No backoff, just update the processAfter to allow immediate retry
                if (jobOpts) {
                  jobOpts.processAfter = Date.now();
                }
              }

              this.emit('failed', job, errorObj, 'active');
            } else {
              // Max attempts reached or no max attempts specified
              this.emit('failed', job, errorObj, 'active');
              await ociJob.moveToFailed(errorObj);
            }
          }
        }
      } catch (error) {
        this.emit('error', error as Error);
        this.logger.error('Error polling queue', error);
      }
    }, interval);
  }
}
