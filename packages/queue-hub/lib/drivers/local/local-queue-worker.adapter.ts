import { QueueHubJob } from '../../interfaces/queue-hub-job.interface';
import { BaseWorkerAdapter } from '../base/base-worker.adapter';
import { LocalQueueAdapter } from './local-queue.adapter';
import { LocalQueueJobAdapter } from './local-queue-job.adapter';

export class LocalQueueWorkerAdapter extends BaseWorkerAdapter {
  constructor(
    public readonly name: string,
    queue: LocalQueueAdapter,
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
      this.pollingInterval = undefined;
    }
    this.removeAllListeners();
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
    const localJob = job as LocalQueueJobAdapter;
    const backoffDelay = this.calculateBackoffDelay(backoff, currentAttempt);

    localJob.incrementAttempt();
    const nextAttempt = localJob.getCurrentAttempt();

    this.logger.debug(
      `Scheduling retry for job ${job.id} (attempt ${nextAttempt}/${maxAttempts})${backoffDelay > 0 ? ` with backoff delay of ${backoffDelay}ms` : ''}`,
    );

    const jobData = localJob.getJobData();
    jobData.state = 'delayed';
    jobData.jobOpts.processAfter = Date.now() + backoffDelay;
    jobData.jobOpts.currentAttempt = nextAttempt;
  }

  protected async handleJobCompletion(job: QueueHubJob, result: any): Promise<void> {
    await job.moveToCompleted(result);
  }

  protected async handleJobFailure(job: QueueHubJob, error: Error): Promise<void> {
    const localJob = job as LocalQueueJobAdapter;
    await localJob.moveToFailed(error);
  }

  async start(): Promise<void> {
    if (this._isRunning) {
      this.logger.warn('Worker already running, skipping start');
      return;
    }

    if (this.pollingInterval) {
      clearInterval(this.pollingInterval);
      this.pollingInterval = undefined;
    }

    this._isRunning = true;
    const interval = this.options?.pollingInterval || 1000;
    this.logger.debug(`Local worker started, polling every ${interval}ms`);

    this.pollingInterval = setInterval(async () => {
      if (this._isPaused) {
        return;
      }

      try {
        const allJobs = await this.queue.getJobs();
        const readyJobs = this.filterReadyJobs(allJobs);
        const sortedJobs = this.sortJobsByPriority(readyJobs);
        const jobsToProcess = sortedJobs.slice(
          0,
          this.options?.concurrency || 1,
        );

        for (const job of jobsToProcess) {
          const localJob = job as LocalQueueJobAdapter;
          const jobOpts = localJob.getJobOpts();
          const jobData = localJob.getJobData();
          const startTime = Date.now();

          if (localJob.hasExceededMaxAttempts()) {
            this.logger.warn(
              `Job ${job.id} has exceeded max attempts (${jobOpts?.maxAttempts}), marking as failed`,
            );
            const maxAttemptsError = new Error('Max attempts exceeded');
            this.emit('failed', job, maxAttemptsError, 'waiting');
            await localJob.moveToFailed(maxAttemptsError);
            continue;
          }

          if (jobData.state === 'delayed' && localJob.shouldProcessNow()) {
            jobData.state = 'waiting';
          }

          if (jobData.state !== 'waiting') {
            continue;
          }

          jobData.state = 'active';
          this.logger.debug(`Starting to process job ${job.id} (attempt ${localJob.getCurrentAttempt()})`);
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
                'Failed to complete job after successful processing',
                deleteError,
              );
            }
          } catch (error) {
            const processingTime = Date.now() - startTime;
            const currentAttempt = localJob.getCurrentAttempt();
            const maxAttempts = jobOpts?.maxAttempts;
            const errorObj = error as Error;

            this.logger.error(
              `Processor failed for job ${job.id} (attempt ${currentAttempt}/${maxAttempts || '∞'}, ${processingTime}ms)`,
              error,
            );

            if (maxAttempts) {
              const nextAttempt = currentAttempt + 1;
              if (nextAttempt <= maxAttempts) {
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

