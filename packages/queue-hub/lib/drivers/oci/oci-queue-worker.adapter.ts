import { EventEmitter } from 'events';
import { QueueHubJob } from '../../interfaces/queue-hub-job.interface';
import {
  QueueHubWorker,
  QueueHubWorkerListener,
} from '../../interfaces/queue-hub-worker.interface';
import { QueueHubLogger } from '../../utils/logger';
import { OciQueueAdapter } from './oci-queue.adapter';

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

        const jobsToProcess = jobs.slice(0, this.options?.concurrency || 1);
        for (const job of jobsToProcess) {
          const startTime = Date.now();

          this.logger.debug(`Starting to process job ${job.id}`);
          this.emit('active', job, 'waiting');

          try {
            const result = await this.processor(job);
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
            this.logger.error(`Processor failed for job ${job.id} (${processingTime}ms)`, error);

            this.emit('failed', job, error as Error, 'active');
          }
        }
      } catch (error) {
        this.emit('error', error as Error);
        this.logger.error('Error polling queue', error);
      }
    }, interval);
  }
}
