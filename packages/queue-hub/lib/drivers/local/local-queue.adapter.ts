import { JobOpts } from '../../interfaces/queue-hub-job-opts.interface';
import { QueueHubJob } from '../../interfaces/queue-hub-job.interface';
import { BaseQueueAdapter } from '../base/base-queue.adapter';
import { LocalQueueJobAdapter } from './local-queue-job.adapter';
import { StoredJobOpts } from '../base/base-job.adapter';

export class LocalQueueAdapter<T = any, R = any> extends BaseQueueAdapter<T, R> {
  private jobs = new Map<string, LocalQueueJobAdapter<T, R>>();
  private jobIdCounter = 0;

  constructor(
    public readonly name: string,
    defaultJobOptions?: JobOpts,
  ) {
    super(name, defaultJobOptions);
  }

  protected serializeJobOpts(name: string, opts: JobOpts, processAfter: number): StoredJobOpts {
    const createdAt = Date.now();
    return {
      jobName: name,
      priority: opts.priority ?? Number.MAX_SAFE_INTEGER,
      attempts: opts.attempts,
      maxAttempts: opts.attempts,
      delay: opts.delay,
      processAfter,
      timeout: opts.timeout,
      jobId: opts.jobId,
      removeOnComplete: opts.removeOnComplete,
      removeOnFail: opts.removeOnFail,
      lifo: opts.lifo,
      stackTraceLimit: opts.stackTraceLimit,
      repeat: opts.repeat,
      backoff: opts.backoff,
      createdAt,
      currentAttempt: (opts as any)._currentAttempt || 1,
    };
  }

  protected deserializeJobOpts(stored: any): StoredJobOpts | null {
    return stored as StoredJobOpts;
  }

  async add(name: string, data: T, opts?: JobOpts): Promise<QueueHubJob<T, R>> {
    const mergedOpts = this.mergeJobOptions(opts);
    const processAfter = this.calculateProcessAfter(mergedOpts.delay);
    const jobOpts = this.serializeJobOpts(name, mergedOpts, processAfter);
    const jobId = mergedOpts.jobId?.toString() || `local-${++this.jobIdCounter}-${Date.now()}`;

    const jobData = {
      id: jobId,
      name,
      data,
      jobOpts,
      state: mergedOpts.delay && mergedOpts.delay > 0 ? 'delayed' : 'waiting' as const,
      createdAt: Date.now(),
    };

    const job = new LocalQueueJobAdapter<T, R>(jobData);
    this.jobs.set(jobId, job);

    this.logger.debug(`Job added to local queue: ${name} (${jobId})`);
    return job;
  }

  async getJob(jobId: string): Promise<QueueHubJob<T, R> | undefined> {
    return this.jobs.get(jobId);
  }

  async getJobs(_types?: string[], _start?: number, _end?: number): Promise<QueueHubJob<T, R>[]> {
    return Array.from(this.jobs.values());
  }

  async getWaiting(_start?: number, _end?: number): Promise<QueueHubJob<T, R>[]> {
    return Array.from(this.jobs.values()).filter(
      (job) => job.getJobData().state === 'waiting',
    );
  }

  async getActive(_start?: number, _end?: number): Promise<QueueHubJob<T, R>[]> {
    return Array.from(this.jobs.values()).filter(
      (job) => job.getJobData().state === 'active',
    );
  }

  async getCompleted(_start?: number, _end?: number): Promise<QueueHubJob<T, R>[]> {
    return Array.from(this.jobs.values()).filter(
      (job) => {
        const state = job.getJobData().state;
        return state === 'completed' && !job.shouldRemoveOnComplete();
      },
    );
  }

  async getFailed(_start?: number, _end?: number): Promise<QueueHubJob<T, R>[]> {
    return Array.from(this.jobs.values()).filter(
      (job) => {
        const state = job.getJobData().state;
        return state === 'failed' && !job.shouldRemoveOnFail();
      },
    );
  }

  async getDelayed(_start?: number, _end?: number): Promise<QueueHubJob<T, R>[]> {
    return Array.from(this.jobs.values()).filter(
      (job) => job.getJobData().state === 'delayed',
    );
  }

  async getWaitingCount(): Promise<number> {
    return (await this.getWaiting()).length;
  }

  async getActiveCount(): Promise<number> {
    return (await this.getActive()).length;
  }

  async getCompletedCount(): Promise<number> {
    return (await this.getCompleted()).length;
  }

  async getFailedCount(): Promise<number> {
    return (await this.getFailed()).length;
  }

  async getDelayedCount(): Promise<number> {
    return (await this.getDelayed()).length;
  }

  async pause(): Promise<void> {}

  async resume(): Promise<void> {}

  async clean(grace: number, limit: number, type?: string): Promise<any[]> {
    const now = Date.now();
    const cleaned: any[] = [];

    for (const [id, job] of this.jobs.entries()) {
      const jobData = job.getJobData();
      const age = now - jobData.createdAt;

      if (age > grace) {
        if (!type || jobData.state === type) {
          cleaned.push(job.toJSON());
          this.jobs.delete(id);
          if (limit && cleaned.length >= limit) break;
        }
      }
    }

    return cleaned;
  }

  async empty(): Promise<void> {
    this.jobs.clear();
  }

  async close(): Promise<void> {
    this.jobs.clear();
  }

  async remove(jobId: string): Promise<QueueHubJob<T, R> | undefined> {
    const job = this.jobs.get(jobId);
    if (job) {
      this.jobs.delete(jobId);
    }
    return job;
  }

  async removeJobs(_pattern: string): Promise<void> {
    this.jobs.clear();
  }

  async obliterate(_opts?: { force?: boolean }): Promise<void> {
    await this.empty();
  }
}

