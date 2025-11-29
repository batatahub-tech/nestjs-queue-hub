import { QueueHubModule } from '@batatahub.com/nestjs-queue-hub';
import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JobOptsDemoController } from './job-opts-demo.controller';
import { JobOptsDemoProcessor } from './job-opts-demo.processor';
import { JobOptsDemoService } from './job-opts-demo.service';

@Module({
  imports: [
    QueueHubModule.registerQueueAsync({
      name: 'job-opts-demo',
      useFactory: (configService: ConfigService) => ({
        queueId: configService.get<string>(
          'OCI_PROVIDERS_WEBHOOK_QUEUE_ID',
          'ocid1.queue.oc1..example',
        ),
        endpoint: configService.get<string>('OCI_PROVIDERS_WEBHOOK_QUEUE_URL'),
      }),
      inject: [ConfigService],
    }),
  ],
  controllers: [JobOptsDemoController],
  providers: [JobOptsDemoService, JobOptsDemoProcessor],
})
export class JobOptsDemoModule {}

