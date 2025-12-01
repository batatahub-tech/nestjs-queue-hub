import { BackoffOpts } from '../../interfaces/queue-hub-job-opts.interface';
import { QueueHubJob } from '../../interfaces/queue-hub-job.interface';
import { BaseQueueAdapter } from '../../drivers/base/base-queue.adapter';
import { BaseWorkerAdapter } from '../../drivers/base/base-worker.adapter';
import { BaseJobAdapter } from '../../drivers/base/base-job.adapter';

class TestQueueAdapter extends BaseQueueAdapter {
  protected serializeJobOpts(): any {
    return {};
  }
  protected deserializeJobOpts(): any {
    return null;
  }
  async add(): Promise<QueueHubJob> {
    return {} as QueueHubJob;
  }
  async getJob(): Promise<QueueHubJob | undefined> {
    return undefined;
  }
  async getJobs(): Promise<QueueHubJob[]> {
    return [];
  }
  async getWaiting(): Promise<QueueHubJob[]> {
    return [];
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
    return 0;
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
  async empty(): Promise<void> {}
  async close(): Promise<void> {}
  async remove(): Promise<QueueHubJob | undefined> {
    return undefined;
  }
  async removeJobs(): Promise<void> {}
  async obliterate(): Promise<void> {}
}

class TestWorkerAdapter extends BaseWorkerAdapter {
  async close(): Promise<void> {
    this._isRunning = false;
  }

  isRunning(): boolean {
    return this._isRunning;
  }

  isPaused(): boolean {
    return this._isPaused;
  }

  async pause(): Promise<void> {
    this._isPaused = true;
  }

  async resume(): Promise<void> {
    this._isPaused = false;
  }

  async start(): Promise<void> {
    this._isRunning = true;
  }

  protected async handleJobRetry(): Promise<void> {}
  protected async handleJobCompletion(): Promise<void> {}
  protected async handleJobFailure(): Promise<void> {}
}

class TestJobAdapter extends BaseJobAdapter {
  private _id: string;
  private _name: string;
  private _data: any;

  constructor(id: string, name: string, data: any, jobOpts: any) {
    super();
    this._id = id;
    this._name = name;
    this._data = data;
    this._jobOpts = jobOpts;
  }

  protected parseJobOpts(): void {}
  getJobOpts() {
    return this._jobOpts;
  }
  getCurrentAttempt() {
    return this._jobOpts?.currentAttempt || 1;
  }
  incrementAttempt() {
    if (this._jobOpts) {
      this._jobOpts.currentAttempt = (this._jobOpts.currentAttempt || 1) + 1;
    }
  }
  shouldProcessNow() {
    if (!this._jobOpts) return true;
    return Date.now() >= this._jobOpts.processAfter;
  }
  hasExceededMaxAttempts() {
    if (!this._jobOpts?.maxAttempts) return false;
    return (this._jobOpts.currentAttempt || 1) > this._jobOpts.maxAttempts;
  }
  get id() {
    return this._id;
  }
  get name() {
    return this._name;
  }
  get data() {
    return this._data;
  }
  get opts() {
    return {};
  }
  async progress() {}
  async updateProgress() {}
  async update() {}
  async remove() {}
  async retry() {}
  async discard() {}
  async moveToCompleted() {
    return {};
  }
  async moveToFailed() {}
  async finished() {
    return {};
  }
  async waitUntilFinished() {
    return {};
  }
  async getState() {
    return 'waiting';
  }
  toJSON() {
    return { id: this.id, name: this.name, data: this.data };
  }
}

describe('BaseWorkerAdapter', () => {
  let queue: TestQueueAdapter;
  let worker: TestWorkerAdapter;
  let processor: jest.Mock;

  beforeEach(() => {
    queue = new TestQueueAdapter('test-queue');
    processor = jest.fn();
    worker = new TestWorkerAdapter('test-worker', queue, processor);
  });

  afterEach(async () => {
    await worker.close();
    worker.removeAllListeners();
  });

  describe('calculateBackoffDelay', () => {
    it('should return 0 when no backoff', () => {
      expect(worker['calculateBackoffDelay'](undefined, 1)).toBe(0);
    });

    it('should return fixed delay for number backoff', () => {
      expect(worker['calculateBackoffDelay'](2000, 1)).toBe(2000);
      expect(worker['calculateBackoffDelay'](2000, 2)).toBe(2000);
    });

    it('should calculate exponential backoff', () => {
      const backoff: BackoffOpts = {
        type: 'exponential',
        delay: 1000,
      };
      expect(worker['calculateBackoffDelay'](backoff, 1)).toBe(1000);
      expect(worker['calculateBackoffDelay'](backoff, 2)).toBe(2000);
      expect(worker['calculateBackoffDelay'](backoff, 3)).toBe(4000);
    });

    it('should calculate fixed backoff', () => {
      const backoff: BackoffOpts = {
        type: 'fixed',
        delay: 2000,
      };
      expect(worker['calculateBackoffDelay'](backoff, 1)).toBe(2000);
      expect(worker['calculateBackoffDelay'](backoff, 2)).toBe(2000);
    });
  });

  describe('processJobWithTimeout', () => {
    it('should process job without timeout', async () => {
      processor.mockResolvedValue('success');
      const job = {} as QueueHubJob;
      const result = await worker['processJobWithTimeout'](job);
      expect(result).toBe('success');
      expect(processor).toHaveBeenCalledWith(job);
    });

    it('should process job with timeout successfully', async () => {
      processor.mockResolvedValue('success');
      const job = {} as QueueHubJob;
      const result = await worker['processJobWithTimeout'](job, 5000);
      expect(result).toBe('success');
    });

    it('should timeout when processing takes too long', async () => {
      let timeoutId: NodeJS.Timeout;
      processor.mockImplementation(() => new Promise((resolve) => {
        timeoutId = setTimeout(resolve, 10000);
      }));
      const job = {} as QueueHubJob;
      try {
        await expect(worker['processJobWithTimeout'](job, 100)).rejects.toThrow('timed out');
      } finally {
        if (timeoutId!) {
          clearTimeout(timeoutId);
        }
      }
    });
  });

  describe('sortJobsByPriority', () => {
    it('should sort jobs by priority (lower number = higher priority)', () => {
      const job1 = new TestJobAdapter('1', 'job1', {}, {
        jobName: 'job1',
        priority: 10,
        processAfter: Date.now(),
        createdAt: Date.now(),
      });
      const job2 = new TestJobAdapter('2', 'job2', {}, {
        jobName: 'job2',
        priority: 1,
        processAfter: Date.now(),
        createdAt: Date.now(),
      });
      const job3 = new TestJobAdapter('3', 'job3', {}, {
        jobName: 'job3',
        priority: 5,
        processAfter: Date.now(),
        createdAt: Date.now(),
      });

      const sorted = worker['sortJobsByPriority']([job1, job2, job3]);
      expect(sorted[0].id).toBe('2');
      expect(sorted[1].id).toBe('3');
      expect(sorted[2].id).toBe('1');
    });

    it('should handle jobs without priority', () => {
      const job1 = new TestJobAdapter('1', 'job1', {}, {
        jobName: 'job1',
        priority: Number.MAX_SAFE_INTEGER,
        processAfter: Date.now(),
        createdAt: Date.now(),
      });
      const job2 = new TestJobAdapter('2', 'job2', {}, {
        jobName: 'job2',
        priority: 1,
        processAfter: Date.now(),
        createdAt: Date.now(),
      });

      const sorted = worker['sortJobsByPriority']([job1, job2]);
      expect(sorted[0].id).toBe('2');
      expect(sorted[1].id).toBe('1');
    });
  });

  describe('filterReadyJobs', () => {
    it('should filter jobs that are ready to process', () => {
      const job1 = new TestJobAdapter('1', 'job1', {}, {
        jobName: 'job1',
        priority: 0,
        processAfter: Date.now() - 1000,
        createdAt: Date.now(),
      });
      const job2 = new TestJobAdapter('2', 'job2', {}, {
        jobName: 'job2',
        priority: 0,
        processAfter: Date.now() + 5000,
        createdAt: Date.now(),
      });

      const ready = worker['filterReadyJobs']([job1, job2]);
      expect(ready.length).toBe(1);
      expect(ready[0].id).toBe('1');
    });
  });

  describe('worker lifecycle', () => {
    it('should start worker', async () => {
      await worker.start();
      expect(worker.isRunning()).toBe(true);
    });

    it('should pause worker', async () => {
      await worker.start();
      await worker.pause();
      expect(worker.isPaused()).toBe(true);
      expect(worker.isRunning()).toBe(true);
    });

    it('should resume worker', async () => {
      await worker.start();
      await worker.pause();
      await worker.resume();
      expect(worker.isPaused()).toBe(false);
    });

    it('should close worker', async () => {
      await worker.start();
      await worker.close();
      expect(worker.isRunning()).toBe(false);
    });
  });
});

