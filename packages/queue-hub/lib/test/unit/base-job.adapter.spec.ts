import { BackoffOpts, JobOpts } from '../../interfaces/queue-hub-job-opts.interface';
import { QueueHubJob } from '../../interfaces/queue-hub-job.interface';
import { BaseJobAdapter, StoredJobOpts } from '../../drivers/base/base-job.adapter';

class TestJobAdapter extends BaseJobAdapter {
  private _id: string;
  private _name: string;
  private _data: any;

  constructor(id: string, name: string, data: any, jobOpts: StoredJobOpts) {
    super();
    this._id = id;
    this._name = name;
    this._data = data;
    this._jobOpts = jobOpts;
  }

  protected parseJobOpts(): void {
  }

  getJobOpts(): StoredJobOpts | null {
    return this._jobOpts;
  }

  getCurrentAttempt(): number {
    return this._jobOpts?.currentAttempt || 1;
  }

  incrementAttempt(): void {
    if (this._jobOpts) {
      this._jobOpts.currentAttempt = (this._jobOpts.currentAttempt || 1) + 1;
    }
  }

  shouldProcessNow(): boolean {
    if (!this._jobOpts) return true;
    return Date.now() >= this._jobOpts.processAfter;
  }

  hasExceededMaxAttempts(): boolean {
    if (!this._jobOpts || !this._jobOpts.maxAttempts) return false;
    return (this._jobOpts.currentAttempt || 1) > this._jobOpts.maxAttempts;
  }

  get id(): string {
    return this._id;
  }

  get name(): string {
    return this._name;
  }

  get data(): any {
    return this._data;
  }

  get opts(): JobOpts {
    if (!this._jobOpts) return {};
    return {
      priority: this._jobOpts.priority,
      attempts: this._jobOpts.maxAttempts,
      delay: this._jobOpts.delay,
      timeout: this._jobOpts.timeout,
      jobId: this._jobOpts.jobId,
      removeOnComplete: this._jobOpts.removeOnComplete,
      removeOnFail: this._jobOpts.removeOnFail,
      lifo: this._jobOpts.lifo,
      stackTraceLimit: this._jobOpts.stackTraceLimit,
      repeat: this._jobOpts.repeat,
      backoff: this._jobOpts.backoff,
    };
  }

  async progress(): Promise<void> {}
  async updateProgress(): Promise<void> {}
  async update(): Promise<void> {}
  async remove(): Promise<void> {}
  async retry(): Promise<void> {}
  async discard(): Promise<void> {}
  async moveToCompleted(): Promise<any> {
    return {};
  }
  async moveToFailed(): Promise<void> {}
  async finished(): Promise<any> {
    return {};
  }
  async waitUntilFinished(): Promise<any> {
    return {};
  }
  async getState(): Promise<string> {
    return 'waiting';
  }
  toJSON(): any {
    return {
      id: this.id,
      name: this.name,
      data: this.data,
    };
  }
}

describe('BaseJobAdapter', () => {
  describe('calculateBackoffDelay', () => {
    it('should return 0 when no backoff configured', () => {
      const job = new TestJobAdapter('1', 'test', {}, {
        jobName: 'test',
        priority: 0,
        processAfter: Date.now(),
        createdAt: Date.now(),
      });
      expect(job.calculateBackoffDelay(1)).toBe(0);
    });

    it('should return fixed delay for number backoff', () => {
      const job = new TestJobAdapter('1', 'test', {}, {
        jobName: 'test',
        priority: 0,
        processAfter: Date.now(),
        createdAt: Date.now(),
        backoff: 2000,
      });
      expect(job.calculateBackoffDelay(1)).toBe(2000);
    });

    it('should calculate exponential backoff correctly', () => {
      const backoff: BackoffOpts = {
        type: 'exponential',
        delay: 1000,
      };
      const job = new TestJobAdapter('1', 'test', {}, {
        jobName: 'test',
        priority: 0,
        processAfter: Date.now(),
        createdAt: Date.now(),
        backoff,
      });

      expect(job.calculateBackoffDelay(1)).toBe(1000);
      expect(job.calculateBackoffDelay(2)).toBe(2000);
      expect(job.calculateBackoffDelay(3)).toBe(4000);
      expect(job.calculateBackoffDelay(4)).toBe(8000);
    });

    it('should calculate fixed backoff correctly', () => {
      const backoff: BackoffOpts = {
        type: 'fixed',
        delay: 2000,
      };
      const job = new TestJobAdapter('1', 'test', {}, {
        jobName: 'test',
        priority: 0,
        processAfter: Date.now(),
        createdAt: Date.now(),
        backoff,
      });

      expect(job.calculateBackoffDelay(1)).toBe(2000);
      expect(job.calculateBackoffDelay(2)).toBe(2000);
      expect(job.calculateBackoffDelay(3)).toBe(2000);
    });
  });

  describe('shouldRemoveOnComplete', () => {
    it('should return true when removeOnComplete is true', () => {
      const job = new TestJobAdapter('1', 'test', {}, {
        jobName: 'test',
        priority: 0,
        processAfter: Date.now(),
        createdAt: Date.now(),
        removeOnComplete: true,
      });
      expect(job.shouldRemoveOnComplete()).toBe(true);
    });

    it('should return true when removeOnComplete is positive number', () => {
      const job = new TestJobAdapter('1', 'test', {}, {
        jobName: 'test',
        priority: 0,
        processAfter: Date.now(),
        createdAt: Date.now(),
        removeOnComplete: 5,
      });
      expect(job.shouldRemoveOnComplete()).toBe(true);
    });

    it('should return false when removeOnComplete is false', () => {
      const job = new TestJobAdapter('1', 'test', {}, {
        jobName: 'test',
        priority: 0,
        processAfter: Date.now(),
        createdAt: Date.now(),
        removeOnComplete: false,
      });
      expect(job.shouldRemoveOnComplete()).toBe(false);
    });

    it('should return false when removeOnComplete is 0', () => {
      const job = new TestJobAdapter('1', 'test', {}, {
        jobName: 'test',
        priority: 0,
        processAfter: Date.now(),
        createdAt: Date.now(),
        removeOnComplete: 0,
      });
      expect(job.shouldRemoveOnComplete()).toBe(false);
    });
  });

  describe('shouldRemoveOnFail', () => {
    it('should return true when removeOnFail is true', () => {
      const job = new TestJobAdapter('1', 'test', {}, {
        jobName: 'test',
        priority: 0,
        processAfter: Date.now(),
        createdAt: Date.now(),
        removeOnFail: true,
      });
      expect(job.shouldRemoveOnFail()).toBe(true);
    });

    it('should return false when removeOnFail is false', () => {
      const job = new TestJobAdapter('1', 'test', {}, {
        jobName: 'test',
        priority: 0,
        processAfter: Date.now(),
        createdAt: Date.now(),
        removeOnFail: false,
      });
      expect(job.shouldRemoveOnFail()).toBe(false);
    });
  });

  describe('shouldProcessNow', () => {
    it('should return true when processAfter is in the past', () => {
      const job = new TestJobAdapter('1', 'test', {}, {
        jobName: 'test',
        priority: 0,
        processAfter: Date.now() - 1000,
        createdAt: Date.now(),
      });
      expect(job.shouldProcessNow()).toBe(true);
    });

    it('should return false when processAfter is in the future', () => {
      const job = new TestJobAdapter('1', 'test', {}, {
        jobName: 'test',
        priority: 0,
        processAfter: Date.now() + 5000,
        createdAt: Date.now(),
      });
      expect(job.shouldProcessNow()).toBe(false);
    });
  });

  describe('hasExceededMaxAttempts', () => {
    it('should return false when no maxAttempts set', () => {
      const job = new TestJobAdapter('1', 'test', {}, {
        jobName: 'test',
        priority: 0,
        processAfter: Date.now(),
        createdAt: Date.now(),
      });
      expect(job.hasExceededMaxAttempts()).toBe(false);
    });

    it('should return false when currentAttempt <= maxAttempts', () => {
      const job = new TestJobAdapter('1', 'test', {}, {
        jobName: 'test',
        priority: 0,
        processAfter: Date.now(),
        createdAt: Date.now(),
        maxAttempts: 3,
        currentAttempt: 2,
      });
      expect(job.hasExceededMaxAttempts()).toBe(false);
    });

    it('should return true when currentAttempt > maxAttempts', () => {
      const job = new TestJobAdapter('1', 'test', {}, {
        jobName: 'test',
        priority: 0,
        processAfter: Date.now(),
        createdAt: Date.now(),
        maxAttempts: 3,
        currentAttempt: 4,
      });
      expect(job.hasExceededMaxAttempts()).toBe(true);
    });
  });

  describe('incrementAttempt', () => {
    it('should increment currentAttempt', () => {
      const job = new TestJobAdapter('1', 'test', {}, {
        jobName: 'test',
        priority: 0,
        processAfter: Date.now(),
        createdAt: Date.now(),
        currentAttempt: 1,
      });
      expect(job.getCurrentAttempt()).toBe(1);
      job.incrementAttempt();
      expect(job.getCurrentAttempt()).toBe(2);
    });

    it('should set currentAttempt to 1 if undefined', () => {
      const job = new TestJobAdapter('1', 'test', {}, {
        jobName: 'test',
        priority: 0,
        processAfter: Date.now(),
        createdAt: Date.now(),
      });
      expect(job.getCurrentAttempt()).toBe(1);
      job.incrementAttempt();
      expect(job.getCurrentAttempt()).toBe(2);
    });
  });
});

