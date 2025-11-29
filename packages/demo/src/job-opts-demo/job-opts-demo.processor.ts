import { Processor, WorkerHost } from '@batatahub.com/nestjs-queue-hub';

export interface JobOptsDemoData {
  message: string;
  shouldFail?: boolean;
  processingTime?: number;
}

@Processor('job-opts-demo')
export class JobOptsDemoProcessor extends WorkerHost {
  async process(job: any): Promise<any> {
    const data = job.data as JobOptsDemoData;
    const processingTime = data.processingTime || 1000;

    console.log(`[JobOptsDemo] Processing job ${job.id}: ${data.message}`);
    console.log(`[JobOptsDemo] Job options:`, job.opts);

    if (data.shouldFail) {
      throw new Error(`Simulated failure for job: ${data.message}`);
    }

    await new Promise((resolve) => setTimeout(resolve, processingTime));

    return {
      processed: true,
      message: data.message,
      processedAt: new Date().toISOString(),
    };
  }
}

