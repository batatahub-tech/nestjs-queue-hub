import { QueueHubDriver, QueueHubModule } from '@batatahub.com/nestjs-queue-hub';
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AudioModule } from './audio/audio.module';
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
        connection: {
          profile: configService.get<string>('OCI_CONFIG_PROFILE', 'DEFAULT'),
          compartmentId: configService.get<string>('OCI_COMPARTMENT_ID'),
          // Or use tokenAuth instead of profile:
          // tokenAuth: {
          //   tenancyId: configService.get<string>('OCI_TENANCY_ID'),
          //   userId: configService.get<string>('OCI_USER_ID'),
          //   fingerprint: configService.get<string>('OCI_FINGERPRINT'),
          //   privateKey: configService.get<string>('OCI_PRIVATE_KEY'),
          // },
        },
      }),
      inject: [ConfigService],
    }),
    AudioModule,
    NotificationModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
