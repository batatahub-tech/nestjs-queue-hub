import { QueueHubModule } from '@batatahub.com/nestjs-queue-hub';
import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AudioController } from './audio.controller';
import { AudioProcessor } from './audio.processor';
import { AudioService } from './audio.service';

@Module({
  imports: [
    QueueHubModule.registerQueueAsync({
      name: 'audio',
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
  controllers: [AudioController],
  providers: [AudioService, AudioProcessor],
})
export class AudioModule {}
