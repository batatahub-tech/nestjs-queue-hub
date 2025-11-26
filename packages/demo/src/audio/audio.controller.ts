import { Body, Controller, Get, HttpCode, HttpStatus, Param, Post } from '@nestjs/common';
import { AudioJobData } from './audio.processor';
import { AudioService } from './audio.service';

@Controller('api/audio')
export class AudioController {
  constructor(private readonly audioService: AudioService) {}

  @Post('process')
  @HttpCode(HttpStatus.ACCEPTED)
  async processAudio(@Body() data: AudioJobData) {
    return this.audioService.processAudio(data);
  }

  @Get('job/:jobId')
  async getJobStatus(@Param('jobId') jobId: string) {
    return this.audioService.getJobStatus(jobId);
  }

  @Get('stats')
  async getStats() {
    return this.audioService.getQueueStats();
  }
}
