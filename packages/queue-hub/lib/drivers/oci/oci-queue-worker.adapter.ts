import { QueueHubJob } from '../../interfaces/queue-hub-job.interface';
import { BaseWorkerAdapter } from '../base/base-worker.adapter';
import { OciQueueAdapter } from './oci-queue.adapter';
import { OciQueueJobAdapter } from './oci-queue-job.adapter';

export class OciQueueWorkerAdapter extends BaseWorkerAdapter {
  constructor(
    public readonly name: string,
    queue: OciQueueAdapter,
    processor: (job: QueueHubJob) => Promise<any>,
    options?: {
      concurrency?: number;
      visibilityTimeout?: number;
      pollingInterval?: number;
    },
  ) {
    super(name, queue, processor, options);
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

  protected async handleJobRetry(
    job: QueueHubJob,
    error: Error,
    currentAttempt: number,
    maxAttempts: number | undefined,
    backoff: number | any | undefined,
  ): Promise<void> {
    const ociJob = job as OciQueueJobAdapter;
    const backoffDelay = this.calculateBackoffDelay(backoff, currentAttempt);

    ociJob.incrementAttempt();
    const nextAttempt = ociJob.getCurrentAttempt();

    if (backoffDelay > 0) {
      this.logger.debug(
        `Scheduling retry for job ${job.id} (attempt ${nextAttempt}/${maxAttempts}) with backoff delay of ${backoffDelay}ms`,
      );

      await ociJob.remove();

      const retryOpts: any = {
        ...ociJob.opts,
        delay: backoffDelay,
        attempts: maxAttempts,
      };

      (retryOpts as any)._currentAttempt = nextAttempt;

      await this.queue.add(ociJob.name, ociJob.data, retryOpts);
      this.logger.debug(`Job ${ociJob.name} re-queued with ${backoffDelay}ms delay for retry (attempt ${nextAttempt})`);
    }
  }

  protected async handleJobCompletion(job: QueueHubJob, result: any): Promise<void> {
    await job.moveToCompleted(result);
  }

  protected async handleJobFailure(job: QueueHubJob, error: Error): Promise<void> {
    const ociJob = job as OciQueueJobAdapter;
    await ociJob.moveToFailed(error);
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

        const readyJobs = this.filterReadyJobs(jobs);
        const sortedJobs = this.sortJobsByPriority(readyJobs);
        const jobsToProcess = sortedJobs.slice(
          0,
          this.options?.concurrency || 1,
        );

        for (const job of jobsToProcess) {
          const ociJob = job as OciQueueJobAdapter;
          const jobOpts = ociJob.getJobOpts();
          const startTime = Date.now();

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
            const result = await this.processJobWithTimeout(job, jobOpts?.timeout);
            const processingTime = Date.now() - startTime;

            this.logger.debug(
              `Processor completed successfully for job ${job.id} (${processingTime}ms)`,
            );

            try {
              await this.handleJobCompletion(job, result);
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

            if (maxAttempts && currentAttempt < maxAttempts) {
              await this.handleJobRetry(
                job,
                errorObj,
                currentAttempt,
                maxAttempts,
                jobOpts?.backoff,
              );
              this.emit('failed', job, errorObj, 'active');
            } else {
              this.emit('failed', job, errorObj, 'active');
              await this.handleJobFailure(job, errorObj);
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
