import { JobOpts } from '../../interfaces/queue-hub-job-opts.interface';
import { QueueHubJob } from '../../interfaces/queue-hub-job.interface';
import { QueueHubQueue } from '../../interfaces/queue-hub-queue.interface';
import { QueueHubLogger } from '../../utils/logger';

export abstract class BaseQueueAdapter<T = any, R = any> implements QueueHubQueue<T, R> {
  protected readonly logger: QueueHubLogger;
  protected readonly defaultJobOptions?: JobOpts;

  constructor(
    public readonly name: string,
    defaultJobOptions?: JobOpts,
  ) {
    this.logger = new QueueHubLogger(`${this.constructor.name}:${name}`);
    this.defaultJobOptions = defaultJobOptions;
  }

  protected mergeJobOptions(opts?: JobOpts): JobOpts {
    return {
      ...this.defaultJobOptions,
      ...opts,
    };
  }

  protected calculateProcessAfter(delay?: number): number {
    const now = Date.now();
    return delay && delay > 0 ? now + delay : now;
  }

  protected abstract serializeJobOpts(
    name: string,
    opts: JobOpts,
    processAfter: number,
  ): any;

  protected abstract deserializeJobOpts(stored: any): any | null;

  abstract add(name: string, data: T, opts?: JobOpts): Promise<QueueHubJob<T, R>>;
  abstract getJob(jobId: string): Promise<QueueHubJob<T, R> | undefined>;
  abstract getJobs(types?: string[], start?: number, end?: number): Promise<QueueHubJob<T, R>[]>;
  abstract getWaiting(start?: number, end?: number): Promise<QueueHubJob<T, R>[]>;
  abstract getActive(start?: number, end?: number): Promise<QueueHubJob<T, R>[]>;
  abstract getCompleted(start?: number, end?: number): Promise<QueueHubJob<T, R>[]>;
  abstract getFailed(start?: number, end?: number): Promise<QueueHubJob<T, R>[]>;
  abstract getDelayed(start?: number, end?: number): Promise<QueueHubJob<T, R>[]>;
  abstract getWaitingCount(): Promise<number>;
  abstract getActiveCount(): Promise<number>;
  abstract getCompletedCount(): Promise<number>;
  abstract getFailedCount(): Promise<number>;
  abstract getDelayedCount(): Promise<number>;
  abstract pause(): Promise<void>;
  abstract resume(): Promise<void>;
  abstract clean(grace: number, limit: number, type?: string): Promise<any[]>;
  abstract empty(): Promise<void>;
  abstract close(): Promise<void>;
  abstract remove(jobId: string): Promise<QueueHubJob<T, R> | undefined>;
  abstract removeJobs(pattern: string): Promise<void>;
  abstract obliterate(opts?: { force?: boolean }): Promise<void>;
}

