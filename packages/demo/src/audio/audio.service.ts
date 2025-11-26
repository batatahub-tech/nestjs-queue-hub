import { InjectQueue } from '@batatahub.com/nestjs-queue-hub';
import { QueueHubQueue } from '@batatahub.com/nestjs-queue-hub';
import { Inject, Injectable } from '@nestjs/common';
import { AudioJobData } from './audio.processor';

@Injectable()
export class AudioService {
  constructor(@InjectQueue('audio') private audioQueue: QueueHubQueue<AudioJobData>) {}

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
      state: 'unknown', // OCI Queue doesn't track state
      progress: 0, // OCI Queue doesn't track progress
      attemptsMade: 0, // OCI Queue tracks via delivery-count but not exposed here
      failedReason: null,
    };
  }

  async getQueueStats() {
    const [waiting, active, completed, failed, delayed] = await Promise.all([
      this.audioQueue.getWaitingCount(),
      this.audioQueue.getActiveCount(),
      this.audioQueue.getCompletedCount(),
      this.audioQueue.getFailedCount(),
      this.audioQueue.getDelayedCount(),
    ]);

    return {
      waiting,
      active,
      completed,
      failed,
      delayed,
    };
  }
}
