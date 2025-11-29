import { Body, Controller, Get, HttpCode, HttpStatus, Param, Post, Query } from '@nestjs/common';
import { JobOptsDemoService } from './job-opts-demo.service';

@Controller('api/job-opts-demo')
export class JobOptsDemoController {
  constructor(private readonly service: JobOptsDemoService) {}

  @Post('test-delay')
  @HttpCode(HttpStatus.ACCEPTED)
  async testDelay(@Body() body: { delayMs?: number }) {
    return this.service.testDelay(body.delayMs || 5000);
  }

  @Post('test-priority')
  @HttpCode(HttpStatus.ACCEPTED)
  async testPriority() {
    return this.service.testPriority(1);
  }

  @Post('test-attempts')
  @HttpCode(HttpStatus.ACCEPTED)
  async testAttempts(@Body() body: { maxAttempts?: number; shouldFail?: boolean }) {
    return this.service.testAttempts(body.maxAttempts || 3, body.shouldFail !== false);
  }

  @Post('test-timeout')
  @HttpCode(HttpStatus.ACCEPTED)
  async testTimeout(@Body() body: { timeoutMs?: number; processingTime?: number }) {
    return this.service.testTimeout(body.timeoutMs || 5000, body.processingTime || 3000);
  }

  @Post('test-backoff')
  @HttpCode(HttpStatus.ACCEPTED)
  async testBackoff(
    @Body() body: { type?: 'fixed' | 'exponential'; delay?: number },
  ) {
    return this.service.testBackoff(body.type || 'exponential', body.delay || 1000);
  }

  @Post('test-remove-on-complete')
  @HttpCode(HttpStatus.ACCEPTED)
  async testRemoveOnComplete(@Body() body: { remove?: boolean }) {
    return this.service.testRemoveOnComplete(body.remove !== false);
  }

  @Post('test-remove-on-fail')
  @HttpCode(HttpStatus.ACCEPTED)
  async testRemoveOnFail(@Body() body: { remove?: boolean }) {
    return this.service.testRemoveOnFail(body.remove !== false);
  }

  @Post('test-job-id')
  @HttpCode(HttpStatus.ACCEPTED)
  async testJobId(@Body() body: { jobId?: string }) {
    return this.service.testJobId(body.jobId || `custom-${Date.now()}`);
  }

  @Post('test-lifo')
  @HttpCode(HttpStatus.ACCEPTED)
  async testLifo(@Body() body: { lifo?: boolean }) {
    return this.service.testLifo(body.lifo !== false);
  }

  @Post('test-complex')
  @HttpCode(HttpStatus.ACCEPTED)
  async testComplexJob() {
    return this.service.testComplexJob();
  }

  @Get('job/:jobId')
  async getJobStatus(@Param('jobId') jobId: string) {
    return this.service.getJobStatus(jobId);
  }

  @Get('stats')
  async getStats() {
    return this.service.getQueueStats();
  }
}

