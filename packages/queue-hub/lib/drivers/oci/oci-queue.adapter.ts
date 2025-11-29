import { QueueClient, models } from 'oci-queue';
import { JobOpts } from '../../interfaces/queue-hub-job-opts.interface';
import { QueueHubJob } from '../../interfaces/queue-hub-job.interface';
import { BaseQueueAdapter } from '../base/base-queue.adapter';
import { OciQueueJobAdapter } from './oci-queue-job.adapter';

export class OciQueueAdapter<T = any, R = any> extends BaseQueueAdapter<T, R> {
  constructor(
    public readonly name: string,
    private readonly queueClient: QueueClient,
    private readonly queueId: string,
    defaultJobOptions?: JobOpts,
  ) {
    super(name, defaultJobOptions);
  }

  protected serializeJobOpts(name: string, opts: JobOpts, processAfter: number): any {
    const createdAt = Date.now();
    return {
      channelId: 'default',
      _jobOpts: JSON.stringify({
        jobName: name,
        priority: opts.priority ?? 0,
        attempts: opts.attempts,
        maxAttempts: opts.attempts,
        delay: opts.delay,
        processAfter,
        timeout: opts.timeout,
        jobId: opts.jobId,
        removeOnComplete: opts.removeOnComplete,
        removeOnFail: opts.removeOnFail,
        lifo: opts.lifo,
        stackTraceLimit: opts.stackTraceLimit,
        repeat: opts.repeat,
        backoff: opts.backoff,
        createdAt,
        currentAttempt: (opts as any)._currentAttempt || 1,
      }),
    };
  }

  protected deserializeJobOpts(stored: any): any | null {
    try {
      const jobOptsStr = stored?._jobOpts;
      if (jobOptsStr) {
        return JSON.parse(jobOptsStr);
      }
    } catch (error) {
      this.logger.warn('Failed to deserialize job options', error);
    }
    return null;
  }

  async add(name: string, data: T, opts?: JobOpts): Promise<QueueHubJob<T, R>> {
    const mergedOpts = this.mergeJobOptions(opts);
    const contentString = JSON.stringify(data);
    const contentBase64 = Buffer.from(contentString).toString('base64');
    const processAfter = this.calculateProcessAfter(mergedOpts.delay);
    const delayMs = mergedOpts.delay || 0;
    const now = Date.now();
    const metadata = this.serializeJobOpts(name, mergedOpts, processAfter);

    const putMessagesDetails: models.PutMessagesDetails = {
      messages: [
        {
          content: contentBase64,
          metadata,
        },
      ],
    };

    const putMessagesRequest: any = {
      queueId: this.queueId,
      putMessagesDetails,
    };

    this.logger.debug(`Adding message to queue: ${name}${delayMs > 0 ? ` (delayed by ${delayMs}ms)` : ''}`);
    const response = await this.queueClient.putMessages(putMessagesRequest);
    this.logger.debug(`Message added successfully, opcRequestId: ${response.opcRequestId}`);

    const messageId = mergedOpts.jobId?.toString() || response.opcRequestId || '';
    const message: any = {
      id: messageId,
      receipt: response.opcRequestId || '',
      content: contentBase64,
      deliveryCount: 0,
      visibleAfter: new Date(processAfter),
      expireAfter: new Date(),
      createdAt: new Date(now),
      metadata,
    };

    return new OciQueueJobAdapter<T, R>(message, this.queueClient, this.queueId);
  }

  async getJob(jobId: string): Promise<QueueHubJob<T, R> | undefined> {
    const messages = await this.getMessages();
    return messages.find((job) => job.id === jobId);
  }

  async getMessages(): Promise<QueueHubJob<T, R>[]> {
    const getMessagesRequest: any = {
      queueId: this.queueId,
      limit: 20,
      visibilityInSeconds: 30,
    };

    try {
      const response = await this.queueClient.getMessages(getMessagesRequest);

      let messages: models.GetMessage[] = [];

      if (
        (response as any).getMessages?.messages &&
        Array.isArray((response as any).getMessages.messages)
      ) {
        messages = (response as any).getMessages.messages;
      } else if ((response as any).items && Array.isArray((response as any).items)) {
        messages = (response as any).items;
      } else if ((response as any).messages && Array.isArray((response as any).messages)) {
        messages = (response as any).messages;
      } else if (
        (response as any).data?.messages &&
        Array.isArray((response as any).data.messages)
      ) {
        messages = (response as any).data.messages;
      } else if (Array.isArray(response)) {
        messages = response as models.GetMessage[];
      } else {
        this.logger.warn('Unexpected response structure from getMessages', {
          keys: Object.keys(response || {}),
        });
      }

      if (messages.length > 0) {
        this.logger.debug(`Received ${messages.length} message(s) from queue`);
      }

      return messages.map(
        (msg: models.GetMessage) =>
          new OciQueueJobAdapter<T, R>(msg, this.queueClient, this.queueId),
      );
    } catch (error) {
      this.logger.error('Error fetching messages from OCI Queue', error);
      throw error;
    }
  }

  async getJobs(_types?: string[], _start?: number, _end?: number): Promise<QueueHubJob<T, R>[]> {
    return this.getMessages();
  }

  async getWaiting(_start?: number, _end?: number): Promise<QueueHubJob<T, R>[]> {
    return this.getMessages();
  }

  async getActive(_start?: number, _end?: number): Promise<QueueHubJob<T, R>[]> {
    return this.getMessages();
  }

  async getCompleted(_start?: number, _end?: number): Promise<QueueHubJob<T, R>[]> {
    return [];
  }

  async getFailed(_start?: number, _end?: number): Promise<QueueHubJob<T, R>[]> {
    return [];
  }

  async getDelayed(_start?: number, _end?: number): Promise<QueueHubJob<T, R>[]> {
    return [];
  }

  async getWaitingCount(): Promise<number> {
    const stats = await this.getStats();
    return (stats as any).visibleMessages || 0;
  }

  async getActiveCount(): Promise<number> {
    const stats = await this.getStats();
    return (stats as any).inFlightMessages || 0;
  }

  async getCompletedCount(): Promise<number> {
    return 0;
  }

  async getFailedCount(): Promise<number> {
    return 0;
  }

  async getDelayedCount(): Promise<number> {
    return 0;
  }

  private async getStats(): Promise<models.QueueStats> {
    const getStatsRequest: any = {
      queueId: this.queueId,
    };
    const response = await this.queueClient.getStats(getStatsRequest);
    return (response as any).queueStats || ({} as models.QueueStats);
  }

  async pause(): Promise<void> {}

  async resume(): Promise<void> {}

  async clean(_grace: number, _limit: number, _type?: string): Promise<any[]> {
    return [];
  }

  async empty(): Promise<void> {}

  async close(): Promise<void> {}

  async remove(jobId: string): Promise<QueueHubJob<T, R> | undefined> {
    const job = await this.getJob(jobId);
    if (job) {
      await job.remove();
    }
    return job;
  }

  async removeJobs(_pattern: string): Promise<void> {}

  async obliterate(_opts?: { force?: boolean }): Promise<void> {
    await this.empty();
  }
}
