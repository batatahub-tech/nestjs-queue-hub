import { Processor, QueueHubJob, WorkerHost } from '@batatahub.com/nestjs-queue-hub';
import { Logger } from '@nestjs/common';

export interface NotificationJobData {
  userId: string;
  type: 'push' | 'sms' | 'in-app';
  title: string;
  message: string;
  metadata?: Record<string, any>;
}

@Processor('notification')
export class NotificationProcessor extends WorkerHost {
  private readonly logger = new Logger(NotificationProcessor.name);

  async process(job: QueueHubJob<NotificationJobData, void>): Promise<void> {
    const startTime = Date.now();
    this.logger.log(`🔵 [DEBUG] Processing notification job ${job.id}`);
    this.logger.log(`🔵 [DEBUG] Job Data: ${JSON.stringify(job.data)}`);
    this.logger.log(`🔵 [DEBUG] Timestamp: ${new Date().toISOString()}`);

    const { userId, type, title, message, metadata } = job.data;

    await job.updateProgress(25);
    this.logger.log(
      `🔵 [DEBUG] [${job.id}] Progress: 25% - Preparing ${type} notification for user ${userId}`,
    );

    await this.delay(300);
    await job.updateProgress(50);
    this.logger.log(`🔵 [DEBUG] [${job.id}] Progress: 50% - Title: ${title}`);
    this.logger.log(`🔵 [DEBUG] [${job.id}] Message: ${message}`);

    if (metadata) {
      this.logger.log(`🔵 [DEBUG] [${job.id}] Metadata: ${JSON.stringify(metadata)}`);
    }

    await this.delay(400);
    await job.updateProgress(75);
    this.logger.log(`🔵 [DEBUG] [${job.id}] Progress: 75% - Sending ${type} notification...`);

    await this.delay(300);
    await job.updateProgress(100);

    const processingTime = Date.now() - startTime;
    this.logger.log(
      `✅ [DEBUG] Notification sent - Job ${job.id} - Type: ${type} - User: ${userId}`,
    );
    this.logger.log(`✅ [DEBUG] Processing time: ${processingTime}ms`);
    this.logger.log('✅ [DEBUG] ========================================');
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
