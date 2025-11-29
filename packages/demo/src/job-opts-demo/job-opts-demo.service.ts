import { InjectQueue, JobOpts, QueueHubQueue } from '@batatahub.com/nestjs-queue-hub';
import { Injectable } from '@nestjs/common';
import { JobOptsDemoData } from './job-opts-demo.processor';

@Injectable()
export class JobOptsDemoService {
  constructor(
    @InjectQueue('job-opts-demo')
    private queue: QueueHubQueue<JobOptsDemoData>,
  ) {}

  async testDelay(delayMs: number) {
    const job = await this.queue.add(
      'delayed-job',
      { message: `This job will be delayed by ${delayMs}ms` },
      { delay: delayMs },
    );

    return {
      jobId: job.id,
      message: `Job created with ${delayMs}ms delay`,
      willProcessAfter: new Date(Date.now() + delayMs).toISOString(),
    };
  }

  async testPriority(priority: number) {
    const jobs = await Promise.all([
      this.queue.add('low-priority', { message: 'Low priority job' }, { priority: 10 }),
      this.queue.add('high-priority', { message: 'High priority job' }, { priority: 1 }),
      this.queue.add('medium-priority', { message: 'Medium priority job' }, { priority: 5 }),
    ]);

    return {
      message: 'Three jobs created with different priorities (1=highest, 10=lowest)',
      jobs: jobs.map((job) => ({
        id: job.id,
        name: job.name,
        priority: job.opts?.priority,
      })),
    };
  }

  async testAttempts(maxAttempts: number, shouldFail: boolean = true) {
    const job = await this.queue.add(
      'retry-job',
      { message: `This job will retry up to ${maxAttempts} times`, shouldFail },
      {
        attempts: maxAttempts,
        backoff: {
          type: 'exponential',
          delay: 1000,
        },
      },
    );

    return {
      jobId: job.id,
      message: `Job created with ${maxAttempts} max attempts and exponential backoff`,
      backoff: 'exponential (1000ms base)',
    };
  }

  async testTimeout(timeoutMs: number, processingTime: number) {
    const job = await this.queue.add(
      'timeout-job',
      {
        message: `This job will timeout after ${timeoutMs}ms`,
        processingTime,
      },
      { timeout: timeoutMs },
    );

    return {
      jobId: job.id,
      message: `Job created with ${timeoutMs}ms timeout`,
      processingTime,
      willTimeout: processingTime > timeoutMs,
    };
  }

  async testBackoff(backoffType: 'fixed' | 'exponential', delay: number) {
    const job = await this.queue.add(
      'backoff-job',
      { message: `Testing ${backoffType} backoff`, shouldFail: true },
      {
        attempts: 3,
        backoff: {
          type: backoffType,
          delay,
        },
      },
    );

    return {
      jobId: job.id,
      message: `Job created with ${backoffType} backoff (${delay}ms delay)`,
      attempts: 3,
    };
  }

  async testRemoveOnComplete(remove: boolean) {
    const job = await this.queue.add(
      'remove-on-complete',
      { message: 'This job will be removed on completion' },
      {
        removeOnComplete: remove,
      },
    );

    return {
      jobId: job.id,
      message: `Job created with removeOnComplete=${remove}`,
    };
  }

  async testRemoveOnFail(remove: boolean) {
    const job = await this.queue.add(
      'remove-on-fail',
      { message: 'This job will fail and be removed', shouldFail: true },
      {
        attempts: 1,
        removeOnFail: remove,
      },
    );

    return {
      jobId: job.id,
      message: `Job created with removeOnFail=${remove}`,
      willFail: true,
    };
  }

  async testJobId(customJobId: string) {
    const job = await this.queue.add(
      'custom-job-id',
      { message: 'Job with custom ID' },
      { jobId: customJobId },
    );

    return {
      jobId: job.id,
      customJobId,
      message: 'Job created with custom jobId',
    };
  }

  async testLifo(lifo: boolean) {
    const jobs = await Promise.all([
      this.queue.add('lifo-1', { message: 'First job' }, { lifo }),
      this.queue.add('lifo-2', { message: 'Second job' }, { lifo }),
      this.queue.add('lifo-3', { message: 'Third job' }, { lifo }),
    ]);

    return {
      message: `Three jobs created with LIFO=${lifo}`,
      jobs: jobs.map((job) => ({
        id: job.id,
        name: job.name,
      })),
      expectedOrder: lifo ? '3, 2, 1' : '1, 2, 3',
    };
  }

  async testComplexJob() {
    const job = await this.queue.add(
      'complex-job',
      {
        message: 'Complex job with multiple options',
        processingTime: 2000,
      },
      {
        priority: 1,
        delay: 5000,
        attempts: 3,
        timeout: 10000,
        backoff: {
          type: 'exponential',
          delay: 2000,
        },
        removeOnComplete: true,
        jobId: `complex-${Date.now()}`,
      },
    );

    return {
      jobId: job.id,
      message: 'Complex job created with all options',
      options: {
        priority: 1,
        delay: 5000,
        attempts: 3,
        timeout: 10000,
        backoff: 'exponential (2000ms)',
        removeOnComplete: true,
        customJobId: true,
      },
    };
  }

  async getJobStatus(jobId: string) {
    const job = await this.queue.getJob(jobId);
    if (!job) {
      return { error: 'Job not found' };
    }

    const jobOpts = (job as any).getJobOpts?.();

    return {
      id: job.id,
      name: job.name,
      data: job.data,
      opts: job.opts,
      currentAttempt: jobOpts?.currentAttempt,
      maxAttempts: jobOpts?.maxAttempts,
      processAfter: jobOpts?.processAfter
        ? new Date(jobOpts.processAfter).toISOString()
        : null,
      shouldProcessNow: (job as any).shouldProcessNow?.(),
    };
  }

  async getQueueStats() {
    const [waiting, active, completed, failed, delayed] = await Promise.all([
      this.queue.getWaitingCount(),
      this.queue.getActiveCount(),
      this.queue.getCompletedCount(),
      this.queue.getFailedCount(),
      this.queue.getDelayedCount(),
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

