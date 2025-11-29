import { QueueClient, models } from 'oci-queue';
import { JobOpts } from '../../interfaces/queue-hub-job-opts.interface';
import { BaseJobAdapter, StoredJobOpts } from '../base/base-job.adapter';

export class OciQueueJobAdapter<T = any, R = any> extends BaseJobAdapter<T, R> {
  constructor(
    private readonly message: models.GetMessage,
    private readonly queueClient: QueueClient,
    private readonly queueId: string,
  ) {
    super();
    this.parseJobOpts();
  }

  protected parseJobOpts(): void {
    try {
      const jobOptsStr = (this.message.metadata as any)?._jobOpts;
      if (jobOptsStr) {
        this._jobOpts = JSON.parse(jobOptsStr) as StoredJobOpts;
        if (this._jobOpts && this._jobOpts.currentAttempt === undefined) {
          this._jobOpts.currentAttempt = 1;
        }
      }
    } catch (error) {
      this.logger.warn('Failed to parse job options from metadata', error);
    }
  }

  get id(): string {
    return String(this.message.id || this.message.receipt || '');
  }

  get name(): string {
    return this._jobOpts?.jobName || '';
  }

  get data(): T {
    try {
      const content = this.message.content || '';
      const decodedContent = Buffer.from(content, 'base64').toString('utf-8');
      return JSON.parse(decodedContent) as T;
    } catch (error) {
      console.error('Error parsing message content:', error);
      return {} as T;
    }
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
  }

  shouldProcessNow(): boolean {
    if (!this._jobOpts) return true;
    return Date.now() >= this._jobOpts.processAfter;
  }

  hasExceededMaxAttempts(): boolean {
    if (!this._jobOpts || !this._jobOpts.maxAttempts) return false;
    return (this._jobOpts.currentAttempt || 1) > this._jobOpts.maxAttempts;
  }

  async progress(_value: number | object): Promise<void> {}

  async updateProgress(value: number | object): Promise<void> {
    return this.progress(value);
  }

  async update(_data: T): Promise<void> {}

  async remove(): Promise<void> {
    if (!this.message.receipt) {
      console.warn(
        `[OciQueueJobAdapter] ⚠️  [DEBUG] Cannot remove message ${this.id}: no receipt available`,
      );
      return;
    }

    const deleteMessageRequest: any = {
      queueId: this.queueId,
      messageReceipt: this.message.receipt,
    };

    try {
      this.logger.debug(`Deleting message ${this.id} from OCI Queue`);
      await this.queueClient.deleteMessage(deleteMessageRequest);
      this.logger.debug(`Message ${this.id} successfully deleted`);
    } catch (error) {
      this.logger.error(`Error deleting message ${this.id} from OCI Queue`, error);
    }
  }

  async retry(): Promise<void> {
    this.incrementAttempt();
  }

  async discard(): Promise<void> {
    return this.remove();
  }

  async moveToCompleted(returnValue: R, _token?: string): Promise<any> {
    if (this.shouldRemoveOnComplete()) {
      await this.remove();
    }
    return returnValue;
  }

  async moveToFailed(_error: Error, _token?: string): Promise<void> {
    if (this.shouldRemoveOnFail()) {
      await this.remove();
    }
  }

  async finished(): Promise<R> {
    return {} as R;
  }

  async waitUntilFinished(_timeout?: number): Promise<R> {
    return this.finished();
  }

  async getState(): Promise<string> {
    return 'active';
  }

  toJSON(): any {
    return {
      id: this.id,
      name: this.name,
      data: this.data,
    };
  }
}
