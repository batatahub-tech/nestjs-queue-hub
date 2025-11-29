import { JobOpts } from '../../interfaces/queue-hub-job-opts.interface';
import { BaseJobAdapter, StoredJobOpts } from '../base/base-job.adapter';

interface LocalJobData {
  id: string;
  name: string;
  data: any;
  jobOpts: StoredJobOpts;
  state: 'waiting' | 'active' | 'completed' | 'failed' | 'delayed';
  returnValue?: any;
  failedReason?: Error;
  createdAt: number;
  processedAt?: number;
}

export class LocalQueueJobAdapter<T = any, R = any> extends BaseJobAdapter<T, R> {
  private jobData: LocalJobData;

  constructor(jobData: LocalJobData) {
    super();
    this.jobData = jobData;
    this._jobOpts = jobData.jobOpts;
  }

  protected parseJobOpts(): void {
    this._jobOpts = this.jobData.jobOpts;
  }

  getJobOpts(): StoredJobOpts | null {
    return this._jobOpts;
  }

  getCurrentAttempt(): number {
    return this._jobOpts?.currentAttempt || 1;
  }

  incrementAttempt(): void {
    if (this._jobOpts) {
      this._jobOpts.currentAttempt = (this._jobOpts.currentAttempt || 1) + 1;
    }
    if (this.jobData.jobOpts) {
      this.jobData.jobOpts.currentAttempt = this._jobOpts?.currentAttempt || 1;
    }
  }

  shouldProcessNow(): boolean {
    if (!this._jobOpts) return true;
    return Date.now() >= this._jobOpts.processAfter;
  }

  hasExceededMaxAttempts(): boolean {
    if (!this._jobOpts || !this._jobOpts.maxAttempts) return false;
    return (this._jobOpts.currentAttempt || 1) > this._jobOpts.maxAttempts;
  }

  get id(): string {
    return this.jobData.id;
  }

  get name(): string {
    return this.jobData.name;
  }

  get data(): T {
    return this.jobData.data as T;
  }

  get opts(): JobOpts {
    if (!this._jobOpts) {
      return {};
    }
    return {
      priority: this._jobOpts.priority,
      attempts: this._jobOpts.maxAttempts,
      delay: this._jobOpts.delay,
      timeout: this._jobOpts.timeout,
      jobId: this._jobOpts.jobId,
      removeOnComplete: this._jobOpts.removeOnComplete,
      removeOnFail: this._jobOpts.removeOnFail,
      lifo: this._jobOpts.lifo,
      stackTraceLimit: this._jobOpts.stackTraceLimit,
      repeat: this._jobOpts.repeat,
      backoff: this._jobOpts.backoff,
    };
  }

  async progress(_value: number | object): Promise<void> {}

  async updateProgress(value: number | object): Promise<void> {
    return this.progress(value);
  }

  async update(data: T): Promise<void> {
    this.jobData.data = data;
  }

  async remove(): Promise<void> {
    this.jobData.state = 'completed';
  }

  async retry(): Promise<void> {
    this.incrementAttempt();
    this.jobData.state = 'waiting';
  }

  async discard(): Promise<void> {
    await this.remove();
  }

  async moveToCompleted(returnValue: R, _token?: string): Promise<any> {
    this.jobData.state = 'completed';
    this.jobData.returnValue = returnValue;
    this.jobData.processedAt = Date.now();
    if (this.shouldRemoveOnComplete()) {
      await this.remove();
    }
    return returnValue;
  }

  async moveToFailed(error: Error, _token?: string): Promise<void> {
    this.jobData.state = 'failed';
    this.jobData.failedReason = error;
    this.jobData.processedAt = Date.now();
    if (this.shouldRemoveOnFail()) {
      await this.remove();
    }
  }

  async finished(): Promise<R> {
    return this.jobData.returnValue as R;
  }

  async waitUntilFinished(timeout?: number): Promise<R> {
    const startTime = Date.now();
    while (this.jobData.state !== 'completed' && this.jobData.state !== 'failed') {
      if (timeout && Date.now() - startTime > timeout) {
        throw new Error(`Job ${this.id} wait timeout after ${timeout}ms`);
      }
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    if (this.jobData.state === 'failed') {
      throw this.jobData.failedReason || new Error('Job failed');
    }
    return this.jobData.returnValue as R;
  }

  async getState(): Promise<string> {
    return this.jobData.state;
  }

  toJSON(): any {
    return {
      id: this.id,
      name: this.name,
      data: this.data,
      state: this.jobData.state,
    };
  }

  getJobData(): LocalJobData {
    return this.jobData;
  }
}

