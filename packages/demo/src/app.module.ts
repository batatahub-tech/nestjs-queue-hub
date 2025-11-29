import { QueueHubDriver, QueueHubModule } from '@batatahub.com/nestjs-queue-hub';
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AudioModule } from './audio/audio.module';
import { JobOptsDemoModule } from './job-opts-demo/job-opts-demo.module';
import { NotificationModule } from './notification/notification.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    QueueHubModule.forRootAsync({
      useFactory: (configService: ConfigService) => ({
        driver: QueueHubDriver.OCI_QUEUE,
        localMode: configService.get<string>('QUEUE_HUB_LOCAL_MODE', 'false') === 'true',
        connection: {
          profile: configService.get<string>('OCI_CONFIG_PROFILE', 'DEFAULT'),
          compartmentId: configService.get<string>('OCI_COMPARTMENT_ID'),
        },
        defaultJobOptions: {
          attempts: 3,
          backoff: {
            type: 'exponential',
            delay: 2000,
          },
          removeOnComplete: true,
          removeOnFail: false,
        },
      }),
      inject: [ConfigService],
    }),
    AudioModule,
    NotificationModule,
    JobOptsDemoModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
