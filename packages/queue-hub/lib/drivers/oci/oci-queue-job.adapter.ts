import { QueueClient, models } from 'oci-queue';
import { QueueHubJob } from '../../interfaces/queue-hub-job.interface';
import { QueueHubLogger } from '../../utils/logger';

/**
 * Adapter for OCI Queue Job implementing QueueHubJob interface
 */
export class OciQueueJobAdapter<T = any, R = any> implements QueueHubJob<T, R> {
  private readonly logger: QueueHubLogger;

  constructor(
    private readonly message: models.GetMessage,
    private readonly queueClient: QueueClient,
    private readonly queueId: string,
  ) {
    this.logger = new QueueHubLogger('OciQueueJobAdapter');
  }

  get id(): string {
    return String(this.message.id || this.message.receipt || '');
  }

  get name(): string {
    return (this.message.metadata?.customProperties?.jobName as string) || '';
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

  get opts(): any {
    return {};
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

  async retry(): Promise<void> {}

  async discard(): Promise<void> {
    return this.remove();
  }

  async moveToCompleted(returnValue: R, _token?: string): Promise<any> {
    await this.remove();
    return returnValue;
  }

  async moveToFailed(_error: Error, _token?: string): Promise<void> {
    await this.remove();
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
