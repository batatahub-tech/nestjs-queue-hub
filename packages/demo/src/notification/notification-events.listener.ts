import {
  OnQueueEvent,
  QueueEventsHost,
  QueueEventsListener,
} from '@batatahub.com/nestjs-queue-hub';
import { Logger } from '@nestjs/common';

@QueueEventsListener('notification')
export class NotificationEventsListener extends QueueEventsHost {
  private readonly logger = new Logger(NotificationEventsListener.name);

  @OnQueueEvent('waiting')
  onWaiting({ jobId }: { jobId: string }) {
    this.logger.log(`📋 Job ${jobId} is waiting in queue`);
  }

  @OnQueueEvent('active')
  onActive({ jobId }: { jobId: string }) {
    this.logger.log(`⚙️  Job ${jobId} started processing`);
  }

  @OnQueueEvent('completed')
  onCompleted({ jobId }: { jobId: string }) {
    this.logger.log(`✅ Job ${jobId} completed successfully`);
  }

  @OnQueueEvent('failed')
  onFailed({ jobId, failedReason }: { jobId: string; failedReason: string }) {
    this.logger.error(`❌ Job ${jobId} failed: ${failedReason}`);
  }

  @OnQueueEvent('progress')
  onProgress({ jobId, data }: { jobId: string; data: number | object }) {
    this.logger.debug(`📊 Job ${jobId} progress: ${JSON.stringify(data)}`);
  }

  @OnQueueEvent('stalled')
  onStalled({ jobId }: { jobId: string }) {
    this.logger.warn(`⚠️  Job ${jobId} stalled`);
  }
}
