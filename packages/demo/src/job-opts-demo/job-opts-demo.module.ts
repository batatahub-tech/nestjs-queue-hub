import { QueueHubModule } from '@batatahub.com/nestjs-queue-hub';
import { Module } from '@nestjs/common';
import { JobOptsDemoController } from './job-opts-demo.controller';
import { JobOptsDemoProcessor } from './job-opts-demo.processor';
import { JobOptsDemoService } from './job-opts-demo.service';

@Module({
  imports: [
    QueueHubModule.registerQueue({
      name: 'job-opts-demo',
      queueId: process.env.OCI_QUEUE_ID || '',
      endpoint: process.env.OCI_QUEUE_ENDPOINT || '',
    }),
  ],
  controllers: [JobOptsDemoController],
  providers: [JobOptsDemoService, JobOptsDemoProcessor],
})
export class JobOptsDemoModule {}

