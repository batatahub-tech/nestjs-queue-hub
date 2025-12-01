import { EventEmitter } from 'events';
import { BackoffOpts } from '../../interfaces/queue-hub-job-opts.interface';
import { QueueHubJob } from '../../interfaces/queue-hub-job.interface';
import { QueueHubWorker } from '../../interfaces/queue-hub-worker.interface';
import { QueueHubLogger } from '../../utils/logger';
import { BaseQueueAdapter } from './base-queue.adapter';
import { BaseJobAdapter } from './base-job.adapter';

export abstract class BaseWorkerAdapter extends EventEmitter implements QueueHubWorker {
  protected _isRunning = false;
  protected _isPaused = false;
  protected pollingInterval?: NodeJS.Timeout;
  protected readonly logger: QueueHubLogger;

  constructor(
    public readonly name: string,
    protected readonly queue: BaseQueueAdapter,
    protected readonly processor: (job: QueueHubJob) => Promise<any>,
    protected readonly options?: {
      concurrency?: number;
      visibilityTimeout?: number;
      pollingInterval?: number;
    },
  ) {
    super();
    this.logger = new QueueHubLogger(`${this.constructor.name}:${name}`);
  }

  protected calculateBackoffDelay(backoff: number | BackoffOpts | undefined, attempt: number): number {
    if (!backoff) return 0;

    if (typeof backoff === 'number') {
      return backoff;
    }

    const { type, delay } = backoff;
    if (type === 'exponential') {
      return delay * 2 ** (attempt - 1);
    }
    if (type === 'fixed') {
      return delay;
    }

    return delay || 0;
  }

  protected async processJobWithTimeout(job: QueueHubJob, timeout?: number): Promise<any> {
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

  protected sortJobsByPriority(jobs: QueueHubJob[]): QueueHubJob[] {
    return jobs.sort((a, b) => {
      const jobA = a as BaseJobAdapter;
      const jobB = b as BaseJobAdapter;
      const optsA = jobA.getJobOpts();
      const optsB = jobB.getJobOpts();
      
      const priorityA = optsA?.priority ?? Number.MAX_SAFE_INTEGER;
      const priorityB = optsB?.priority ?? Number.MAX_SAFE_INTEGER;
      
      if (priorityA !== priorityB) {
        return priorityA - priorityB;
      }
      
      const lifoA = optsA?.lifo ?? false;
      const lifoB = optsB?.lifo ?? false;
      const createdAtA = optsA?.createdAt ?? 0;
      const createdAtB = optsB?.createdAt ?? 0;
      
      if (lifoA && lifoB) {
        return createdAtB - createdAtA;
      }
      
      if (lifoA) {
        return -1;
      }
      
      if (lifoB) {
        return 1;
      }
      
      return createdAtA - createdAtB;
    });
  }

  protected filterReadyJobs(jobs: QueueHubJob[]): QueueHubJob[] {
    return jobs.filter((job) => {
      const baseJob = job as BaseJobAdapter;
      return baseJob.shouldProcessNow();
    });
  }

  protected abstract handleJobRetry(
    job: QueueHubJob,
    error: Error,
    currentAttempt: number,
    maxAttempts: number | undefined,
    backoff: number | BackoffOpts | undefined,
  ): Promise<void>;

  protected abstract handleJobCompletion(job: QueueHubJob, result: any): Promise<void>;
  protected abstract handleJobFailure(job: QueueHubJob, error: Error): Promise<void>;

  abstract close(force?: boolean): Promise<void>;
  abstract isRunning(): boolean;
  abstract isPaused(): boolean;
  abstract pause(force?: boolean): Promise<void>;
  abstract resume(): Promise<void>;
  abstract start(): Promise<void>;
}

