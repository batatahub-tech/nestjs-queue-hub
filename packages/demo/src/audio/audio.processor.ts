import { Processor, QueueHubJob, WorkerHost } from '@batatahub.com/nestjs-queue-hub';
import { Logger } from '@nestjs/common';

export interface AudioJobData {
  fileId: string;
  fileName: string;
  format: string;
  duration?: number;
}

@Processor('audio')
export class AudioProcessor extends WorkerHost {
  private readonly logger = new Logger(AudioProcessor.name);

  async process(job: QueueHubJob<AudioJobData, void>): Promise<void> {
    const startTime = Date.now();
    this.logger.log(`🔵 [DEBUG] Processing audio job ${job.id}: ${job.data.fileName}`);
    this.logger.log(`🔵 [DEBUG] Job Data: ${JSON.stringify(job.data)}`);
    this.logger.log(`🔵 [DEBUG] Timestamp: ${new Date().toISOString()}`);

    // Simula processamento de áudio
    const { fileId, fileName, format } = job.data;

    // Atualiza progresso
    await job.updateProgress(10);
    this.logger.log(`🔵 [DEBUG] [${job.id}] Progress: 10% - Loading audio file: ${fileName}`);

    await this.delay(1000);
    await job.updateProgress(30);
    this.logger.log(`🔵 [DEBUG] [${job.id}] Progress: 30% - Converting format: ${format}`);

    await this.delay(1500);
    await job.updateProgress(60);
    this.logger.log(`🔵 [DEBUG] [${job.id}] Progress: 60% - Processing audio effects`);

    await this.delay(2000);
    await job.updateProgress(90);
    this.logger.log(`🔵 [DEBUG] [${job.id}] Progress: 90% - Finalizing...`);

    await this.delay(500);
    await job.updateProgress(100);

    const processingTime = Date.now() - startTime;
    this.logger.log(`✅ [DEBUG] Audio processing completed for job ${job.id} - File: ${fileId}`);
    this.logger.log(`✅ [DEBUG] Processing time: ${processingTime}ms`);
    this.logger.log('✅ [DEBUG] ========================================');
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
