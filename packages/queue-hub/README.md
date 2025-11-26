# @batatahub.com/nestjs-queue-hub

Queue Hub for NestJS supporting multiple drivers (OCI Queue, Redis, SQS, MongoDB, RabbitMQ, etc.)

## Installation

```bash
npm install --save @batatahub.com/nestjs-queue-hub oci-queue oci-common
```

## Quick Start

### 1. Configure the Module

First, configure the module in your root module (`app.module.ts`) specifying which driver to use and authentication settings:

```typescript
import { QueueHubDriver, QueueHubModule } from '@batatahub.com/nestjs-queue-hub';
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    QueueHubModule.forRootAsync({
      useFactory: (configService: ConfigService) => ({
        driver: QueueHubDriver.OCI_QUEUE, // Specify your driver
        connection: {
          profile: configService.get<string>('OCI_CONFIG_PROFILE', 'DEFAULT'),
          compartmentId: configService.get<string>('OCI_COMPARTMENT_ID'),
          // Or use tokenAuth instead of profile:
          // tokenAuth: {
          //   tenancyId: configService.get<string>('OCI_TENANCY_ID'),
          //   userId: configService.get<string>('OCI_USER_ID'),
          //   fingerprint: configService.get<string>('OCI_FINGERPRINT'),
          //   privateKey: configService.get<string>('OCI_PRIVATE_KEY'),
          //   passphrase: configService.get<string>('OCI_PRIVATE_KEY_PASSPHRASE'),
          // },
        },
      }),
      inject: [ConfigService],
    }),
  ],
})
export class AppModule {}
```

### 2. Register a Queue

Register a queue in your feature module. You only need to provide `queueId` and `endpoint` - authentication comes from the root module:

```typescript
import { QueueHubModule } from '@batatahub.com/nestjs-queue-hub';
import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Module({
  imports: [
    QueueHubModule.registerQueueAsync({
      name: 'audio',
      useFactory: (configService: ConfigService) => ({
        queueId: configService.get<string>('OCI_QUEUE_ID'),
        endpoint: configService.get<string>('OCI_QUEUE_URL'),
      }),
      inject: [ConfigService],
    }),
  ],
})
export class AudioModule {}
```

### 3. Create a Processor

Create a processor to handle jobs from the queue:

```typescript
import { Processor, QueueHubJob, WorkerHost } from '@batatahub.com/nestjs-queue-hub';
import { Logger } from '@nestjs/common';

export interface AudioJobData {
  fileId: string;
  fileName: string;
  format: string;
}

@Processor('audio')
export class AudioProcessor extends WorkerHost {
  private readonly logger = new Logger(AudioProcessor.name);

  async process(job: QueueHubJob<AudioJobData>): Promise<void> {
    this.logger.log(`Processing audio job ${job.id}: ${job.data.fileName}`);
    
    // Your processing logic here
    await job.updateProgress(50);
    
    // Process the audio file...
    
    await job.updateProgress(100);
    this.logger.log(`Audio processing completed for job ${job.id}`);
  }
}
```

### 4. Use the Queue in a Service

Inject and use the queue in your service:

```typescript
import { InjectQueue, QueueHubQueue } from '@batatahub.com/nestjs-queue-hub';
import { Injectable } from '@nestjs/common';
import { AudioJobData } from './audio.processor';

@Injectable()
export class AudioService {
  constructor(
    @InjectQueue('audio') private audioQueue: QueueHubQueue<AudioJobData>
  ) {}

  async processAudio(data: AudioJobData) {
    const job = await this.audioQueue.add('process-audio', data);
    
    return {
      jobId: job.id,
      status: 'queued',
      message: 'Audio processing job created successfully',
    };
  }

  async getJobStatus(jobId: string) {
    const job = await this.audioQueue.getJob(jobId);
    if (!job) {
      return { error: 'Job not found' };
    }
    
    return {
      id: job.id,
      name: job.name,
      data: job.data,
    };
  }

  async getQueueStats() {
    const [waiting, active] = await Promise.all([
      this.audioQueue.getWaitingCount(),
      this.audioQueue.getActiveCount(),
    ]);
    
    return { waiting, active };
  }
}
```

## Available Drivers

Currently supported drivers:

- `QueueHubDriver.OCI_QUEUE` - Oracle Cloud Infrastructure Queue

More drivers coming soon (SQS, MongoDB, RabbitMQ, Redis, etc.)

## Configuration Options

### Root Module Configuration (`forRootAsync`)

The root module configuration handles authentication and driver selection. All queues will use these settings.

#### Using Config File (Default)

```typescript
QueueHubModule.forRootAsync({
  useFactory: (configService: ConfigService) => ({
    driver: QueueHubDriver.OCI_QUEUE,
    connection: {
      profile: configService.get<string>('OCI_CONFIG_PROFILE', 'DEFAULT'),
      compartmentId: configService.get<string>('OCI_COMPARTMENT_ID'),
      region: configService.get<string>('OCI_REGION'),
    },
  }),
  inject: [ConfigService],
})
```

#### Using Token Authentication

Instead of using the config file, you can provide credentials directly:

```typescript
import * as fs from 'fs';

QueueHubModule.forRootAsync({
  useFactory: (configService: ConfigService) => ({
    driver: QueueHubDriver.OCI_QUEUE,
    connection: {
      compartmentId: configService.get<string>('OCI_COMPARTMENT_ID'),
      tokenAuth: {
        tenancyId: configService.get<string>('OCI_TENANCY_ID'),
        userId: configService.get<string>('OCI_USER_ID'),
        fingerprint: configService.get<string>('OCI_FINGERPRINT'),
        privateKey: fs.readFileSync(
          configService.get<string>('OCI_PRIVATE_KEY_PATH'),
          'utf8'
        ),
        passphrase: configService.get<string>('OCI_PRIVATE_KEY_PASSPHRASE'), // Optional
      },
    },
  }),
  inject: [ConfigService],
})
```

Or read the private key from an environment variable:

```typescript
connection: {
  tokenAuth: {
    tenancyId: process.env.OCI_TENANCY_ID,
    userId: process.env.OCI_USER_ID,
    fingerprint: process.env.OCI_FINGERPRINT,
    privateKey: process.env.OCI_PRIVATE_KEY, // Base64 encoded or PEM format
    passphrase: process.env.OCI_PRIVATE_KEY_PASSPHRASE, // Optional
  },
}
```

### Queue Registration (`registerQueueAsync`)

When registering a queue, you only need to provide the queue-specific information:

```typescript
QueueHubModule.registerQueueAsync({
  name: 'audio',
  useFactory: (configService: ConfigService) => ({
    queueId: configService.get<string>('OCI_QUEUE_ID'),  // Required
    endpoint: configService.get<string>('OCI_QUEUE_URL'), // Required
    compartmentId: configService.get<string>('OCI_COMPARTMENT_ID'), // Optional: overrides root config
    region: configService.get<string>('OCI_REGION'), // Optional: overrides root config
  }),
  inject: [ConfigService],
})
```

### Log Level

Configure log level globally:

```typescript
import { QueueHubLogLevel } from '@batatahub.com/nestjs-queue-hub';

QueueHubModule.forRootAsync({
  useFactory: () => ({
    driver: QueueHubDriver.OCI_QUEUE,
    logLevel: QueueHubLogLevel.DEBUG, // ERROR, WARN, INFO, DEBUG
  }),
}),
```

## API Reference

### Queue Methods

- `add(name: string, data: T, opts?: any): Promise<QueueHubJob<T, R>>` - Add a job to the queue
- `getJob(jobId: string): Promise<QueueHubJob<T, R> | undefined>` - Get a job by ID
- `getJobs(types?: string[], start?: number, end?: number): Promise<QueueHubJob<T, R>[]>` - Get multiple jobs
- `getWaitingCount(): Promise<number>` - Get count of waiting jobs
- `getActiveCount(): Promise<number>` - Get count of active jobs
- `pause(): Promise<void>` - Pause the queue
- `resume(): Promise<void>` - Resume the queue
- `close(): Promise<void>` - Close the queue connection

### Job Methods

- `updateProgress(value: number | object): Promise<void>` - Update job progress
- `update(data: T): Promise<void>` - Update job data
- `remove(): Promise<void>` - Remove the job
- `retry(): Promise<void>` - Retry the job
- `getState(): Promise<string>` - Get job state

## License

MIT
