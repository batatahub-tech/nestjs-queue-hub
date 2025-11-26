import { InjectQueue, QueueHubQueue } from '@batatahub.com/nestjs-queue-hub';
import { Injectable } from '@nestjs/common';
import { NotificationJobData } from './notification.processor';

@Injectable()
export class NotificationService {
  constructor(
    @InjectQueue('notification')
    private notificationQueue: QueueHubQueue<NotificationJobData>,
  ) {}

  async sendNotification(data: NotificationJobData) {
    const job = await this.notificationQueue.add('send-notification', data);

    return {
      jobId: job.id,
      status: 'queued',
      message: 'Notification job created successfully',
    };
  }

  async sendBulkNotifications(notifications: NotificationJobData[]) {
    const jobs = await Promise.all(
      notifications.map((data) =>
        this.notificationQueue.add('send-notification', data, {
          attempts: 3,
          backoff: {
            type: 'exponential',
            delay: 2000,
          },
        }),
      ),
    );

    return {
      count: jobs.length,
      jobIds: jobs.map((job) => job.id),
      message: `Created ${jobs.length} notification jobs`,
    };
  }

  async getJobStatus(jobId: string) {
    const job = await this.notificationQueue.getJob(jobId);
    if (!job) {
      return { error: 'Job not found' };
    }

    return {
      id: job.id,
      name: job.name,
      data: job.data,
      state: 'unknown', // OCI Queue doesn't track state
      progress: 0, // OCI Queue doesn't track progress
      attemptsMade: 0, // OCI Queue tracks via delivery-count but not exposed here
      failedReason: null,
    };
  }

  async getQueueStats() {
    const [waiting, active, completed, failed, delayed] = await Promise.all([
      this.notificationQueue.getWaitingCount(),
      this.notificationQueue.getActiveCount(),
      this.notificationQueue.getCompletedCount(),
      this.notificationQueue.getFailedCount(),
      this.notificationQueue.getDelayedCount(),
    ]);

    return {
      waiting,
      active,
      completed,
      failed,
      delayed,
    };
  }
}
