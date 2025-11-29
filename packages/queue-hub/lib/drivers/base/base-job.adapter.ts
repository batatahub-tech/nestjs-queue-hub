import { BackoffOpts, JobOpts } from '../../interfaces/queue-hub-job-opts.interface';
import { QueueHubJob } from '../../interfaces/queue-hub-job.interface';
import { QueueHubLogger } from '../../utils/logger';

export interface StoredJobOpts {
  jobName: string;
  priority: number;
  attempts?: number;
  maxAttempts?: number;
  delay?: number;
  processAfter: number;
  timeout?: number;
  jobId?: number | string;
  removeOnComplete?: boolean | number;
  removeOnFail?: boolean | number;
  lifo?: boolean;
  stackTraceLimit?: number;
  repeat?: any;
  backoff?: number | BackoffOpts;
  createdAt: number;
  currentAttempt?: number;
}

export abstract class BaseJobAdapter<T = any, R = any> implements QueueHubJob<T, R> {
  protected readonly logger: QueueHubLogger;
  protected _jobOpts: StoredJobOpts | null = null;

  constructor() {
    this.logger = new QueueHubLogger(this.constructor.name);
  }

  protected abstract parseJobOpts(): void;
  abstract getJobOpts(): StoredJobOpts | null;
  abstract getCurrentAttempt(): number;
  abstract incrementAttempt(): void;
  abstract shouldProcessNow(): boolean;
  abstract hasExceededMaxAttempts(): boolean;

  calculateBackoffDelay(attempt: number): number {
    if (!this._jobOpts?.backoff) return 0;

    const backoff = this._jobOpts.backoff;

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

  shouldRemoveOnComplete(): boolean {
    const removeOnComplete = this._jobOpts?.removeOnComplete;
    return removeOnComplete === true || (typeof removeOnComplete === 'number' && removeOnComplete > 0);
  }

  shouldRemoveOnFail(): boolean {
    const removeOnFail = this._jobOpts?.removeOnFail;
    return removeOnFail === true || (typeof removeOnFail === 'number' && removeOnFail > 0);
  }

  abstract get id(): string;
  abstract get name(): string;
  abstract get data(): T;
  abstract get opts(): JobOpts;
  abstract progress(value: number | object): Promise<void>;
  abstract updateProgress(value: number | object): Promise<void>;
  abstract update(data: T): Promise<void>;
  abstract remove(): Promise<void>;
  abstract retry(): Promise<void>;
  abstract discard(): Promise<void>;
  abstract moveToCompleted(returnValue: R, token?: string): Promise<any>;
  abstract moveToFailed(error: Error, token?: string): Promise<void>;
  abstract finished(): Promise<R>;
  abstract waitUntilFinished(timeout?: number): Promise<R>;
  abstract getState(): Promise<string>;
  abstract toJSON(): any;
}

