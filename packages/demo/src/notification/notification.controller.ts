import { Body, Controller, Get, HttpCode, HttpStatus, Param, Post } from '@nestjs/common';
import { NotificationJobData } from './notification.processor';
import { NotificationService } from './notification.service';

@Controller('api/notification')
export class NotificationController {
  constructor(private readonly notificationService: NotificationService) {}

  @Post('send')
  @HttpCode(HttpStatus.ACCEPTED)
  async sendNotification(@Body() data: NotificationJobData) {
    return this.notificationService.sendNotification(data);
  }

  @Post('send-bulk')
  @HttpCode(HttpStatus.ACCEPTED)
  async sendBulkNotifications(@Body() data: { notifications: NotificationJobData[] }) {
    return this.notificationService.sendBulkNotifications(data.notifications);
  }

  @Get('job/:jobId')
  async getJobStatus(@Param('jobId') jobId: string) {
    return this.notificationService.getJobStatus(jobId);
  }

  @Get('stats')
  async getStats() {
    return this.notificationService.getQueueStats();
  }
}
