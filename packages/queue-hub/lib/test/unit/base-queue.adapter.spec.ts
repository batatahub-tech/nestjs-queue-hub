import { JobOpts } from '../../interfaces/queue-hub-job-opts.interface';
import { QueueHubJob } from '../../interfaces/queue-hub-job.interface';
import { BaseQueueAdapter } from '../../drivers/base/base-queue.adapter';

class TestQueueAdapter extends BaseQueueAdapter {
  private jobs = new Map<string, QueueHubJob>();

  protected serializeJobOpts(name: string, opts: JobOpts, processAfter: number): any {
    return {
      jobName: name,
      priority: opts.priority ?? Number.MAX_SAFE_INTEGER,
      processAfter,
    };
  }

  protected deserializeJobOpts(stored: any): any | null {
    return stored;
  }

  async add(name: string, data: any, opts?: JobOpts): Promise<QueueHubJob> {
    const mergedOpts = this.mergeJobOptions(opts);
    const processAfter = this.calculateProcessAfter(mergedOpts.delay);
    const jobId = `test-${Date.now()}`;
    const job = {
      id: jobId,
      name,
      data,
      opts: {
        ...mergedOpts,
        processAfter,
      },
    } as QueueHubJob;
    this.jobs.set(jobId, job);
    return job;
  }

  async getJob(jobId: string): Promise<QueueHubJob | undefined> {
    return this.jobs.get(jobId);
  }

  async getJobs(): Promise<QueueHubJob[]> {
    return Array.from(this.jobs.values());
  }

  async getWaiting(): Promise<QueueHubJob[]> {
    return Array.from(this.jobs.values());
  }

  async getActive(): Promise<QueueHubJob[]> {
    return [];
  }

  async getCompleted(): Promise<QueueHubJob[]> {
    return [];
  }

  async getFailed(): Promise<QueueHubJob[]> {
    return [];
  }

  async getDelayed(): Promise<QueueHubJob[]> {
    return [];
  }

  async getWaitingCount(): Promise<number> {
    return this.jobs.size;
  }

  async getActiveCount(): Promise<number> {
    return 0;
  }

  async getCompletedCount(): Promise<number> {
    return 0;
  }

  async getFailedCount(): Promise<number> {
    return 0;
  }

  async getDelayedCount(): Promise<number> {
    return 0;
  }

  async pause(): Promise<void> {}

  async resume(): Promise<void> {}

  async clean(): Promise<any[]> {
    return [];
  }

  async empty(): Promise<void> {
    this.jobs.clear();
  }

  async close(): Promise<void> {
    this.jobs.clear();
  }

  async remove(jobId: string): Promise<QueueHubJob | undefined> {
    const job = this.jobs.get(jobId);
    this.jobs.delete(jobId);
    return job;
  }

  async removeJobs(): Promise<void> {
    this.jobs.clear();
  }

  async obliterate(): Promise<void> {
    this.jobs.clear();
  }
}

describe('BaseQueueAdapter', () => {
  let adapter: TestQueueAdapter;

  beforeEach(() => {
    adapter = new TestQueueAdapter('test-queue');
  });

  afterEach(async () => {
    await adapter.close();
  });

  describe('mergeJobOptions', () => {
    it('should merge default options with provided options', async () => {
      const adapterWithDefaults = new TestQueueAdapter('test-queue', {
        attempts: 3,
        priority: 5,
      });

      const job = await adapterWithDefaults.add('test-job', { data: 'test' }, {
        priority: 1,
      });

      expect(job.opts).toMatchObject({
        attempts: 3,
        priority: 1,
      });
    });

    it('should use provided options when no defaults', async () => {
      const job = await adapter.add('test-job', { data: 'test' }, {
        priority: 1,
        attempts: 5,
      });

      expect(job.opts).toMatchObject({
        priority: 1,
        attempts: 5,
      });
    });
  });

  describe('calculateProcessAfter', () => {
    it('should calculate processAfter with delay', async () => {
      const delay = 5000;
      const before = Date.now();
      const job = await adapter.add('test-job', { data: 'test' }, { delay });
      const after = Date.now();

      const processAfter = (job.opts as any).processAfter || 0;
      expect(processAfter).toBeGreaterThanOrEqual(before + delay);
      expect(processAfter).toBeLessThanOrEqual(after + delay);
    });

    it('should calculate processAfter without delay', async () => {
      const before = Date.now();
      const job = await adapter.add('test-job', { data: 'test' });
      const after = Date.now();

      const processAfter = (job.opts as any).processAfter || 0;
      expect(processAfter).toBeGreaterThanOrEqual(before);
      expect(processAfter).toBeLessThanOrEqual(after);
    });
  });

  describe('queue operations', () => {
    it('should add job to queue', async () => {
      const job = await adapter.add('test-job', { data: 'test' });
      expect(job).toBeDefined();
      expect(job.id).toBeDefined();
      expect(job.name).toBe('test-job');
    });

    it('should get job by id', async () => {
      const job = await adapter.add('test-job', { data: 'test' });
      const retrieved = await adapter.getJob(job.id);
      expect(retrieved).toBeDefined();
      expect(retrieved?.id).toBe(job.id);
    });

    it('should return undefined for non-existent job', async () => {
      const retrieved = await adapter.getJob('non-existent');
      expect(retrieved).toBeUndefined();
    });

    it('should get waiting count', async () => {
      const job1 = await adapter.add('job1', { data: 'test1' });
      const job2 = await adapter.add('job2', { data: 'test2' });
      const count = await adapter.getWaitingCount();
      expect(count).toBeGreaterThanOrEqual(1);
      expect(job1).toBeDefined();
      expect(job2).toBeDefined();
    });

    it('should empty queue', async () => {
      await adapter.add('job1', { data: 'test1' });
      await adapter.add('job2', { data: 'test2' });
      await adapter.empty();
      const count = await adapter.getWaitingCount();
      expect(count).toBe(0);
    });

    it('should remove job', async () => {
      const job = await adapter.add('test-job', { data: 'test' });
      const removed = await adapter.remove(job.id);
      expect(removed).toBeDefined();
      const retrieved = await adapter.getJob(job.id);
      expect(retrieved).toBeUndefined();
    });
  });
});

