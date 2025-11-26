import { QueueHubModule } from '@batatahub.com/nestjs-queue-hub';
import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NotificationEventsListener } from './notification-events.listener';
import { NotificationController } from './notification.controller';
import { NotificationProcessor } from './notification.processor';
import { NotificationService } from './notification.service';

@Module({
  imports: [
    QueueHubModule.registerQueueAsync({
      name: 'notification',
      useFactory: (configService: ConfigService) => ({
        connection: {
          queueId: configService.get<string>(
            'OCI_PROVIDERS_WEBHOOK_QUEUE_ID',
            'ocid1.queue.oc1..example',
          ),
          endpoint: configService.get<string>('OCI_PROVIDERS_WEBHOOK_QUEUE_URL'),
        },
      }),
      inject: [ConfigService],
    }),
  ],
  controllers: [NotificationController],
  providers: [NotificationService, NotificationProcessor, NotificationEventsListener],
})
export class NotificationModule {}
