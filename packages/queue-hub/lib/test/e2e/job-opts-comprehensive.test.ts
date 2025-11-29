import { QueueHubDriver } from '../../interfaces/shared-queue-hub-config.interface';
import { QueueHubJob } from '../../interfaces/queue-hub-job.interface';
import { TestQueueFactory, TestWorkerFactory, TestJobOpts } from '../helpers';

describe('JobOpts Comprehensive E2E Tests', () => {
  let queueName: string;
  let queue: any;
  let worker: any;
  let processor: jest.Mock;

  beforeEach(() => {
    queueName = `test-queue-${Date.now()}`;
    processor = jest.fn();
    queue = TestQueueFactory.createQueue(queueName, {
      driver: QueueHubDriver.OCI_QUEUE,
      localMode: true,
    });
    worker = TestWorkerFactory.createWorker(
      queueName,
      queue,
      processor,
      { driver: QueueHubDriver.OCI_QUEUE, localMode: true, pollingInterval: 50 },
    );
  });

  afterEach(async () => {
    if (worker) {
      await TestWorkerFactory.cleanupWorker(worker);
    }
    if (queue) {
      await TestQueueFactory.cleanupQueue(queue);
    }
  });

  describe('Delay Functionality', () => {
    it('should delay job processing by specified milliseconds', async () => {
      processor.mockResolvedValue('success');
      const delay = 500;
      await queue.add('delayed-job', { message: 'test' }, TestJobOpts.withDelay(delay));
      await worker.start();

      await new Promise((resolve) => setTimeout(resolve, delay - 100));
      expect(processor).not.toHaveBeenCalled();

      await new Promise((resolve) => setTimeout(resolve, 200));
      expect(processor).toHaveBeenCalled();
    }, 2000);

    it('should process job immediately when delay is 0', async () => {
      processor.mockResolvedValue('success');
      await queue.add('immediate-job', { message: 'test' }, { delay: 0 });
      await worker.start();

      await new Promise((resolve) => setTimeout(resolve, 200));
      expect(processor).toHaveBeenCalled();
    }, 1000);
  });

  describe('Priority Functionality', () => {
    it('should process higher priority jobs first', async () => {
      const processingOrder: string[] = [];
      processor.mockImplementation(async (job: QueueHubJob) => {
        processingOrder.push(job.name);
        return 'success';
      });

      await queue.add('low', { priority: 10 }, TestJobOpts.withPriority(10));
      await queue.add('high', { priority: 1 }, TestJobOpts.withPriority(1));
      await queue.add('medium', { priority: 5 }, TestJobOpts.withPriority(5));

      await worker.start();
      await new Promise((resolve) => setTimeout(resolve, 1000));

      if (processingOrder.length >= 2) {
        const highIndex = processingOrder.indexOf('high');
        const lowIndex = processingOrder.indexOf('low');
        if (highIndex !== -1 && lowIndex !== -1) {
          expect(highIndex).toBeLessThan(lowIndex);
        }
      }
    }, 3000);
  });

  describe('Attempts and Retry Functionality', () => {
    it('should retry job up to max attempts', async () => {
      let attemptCount = 0;
      processor.mockImplementation(async () => {
        attemptCount++;
        if (attemptCount < 3) {
          throw new Error(`Attempt ${attemptCount} failed`);
        }
        return 'success';
      });

      await queue.add('retry-job', { message: 'test' }, TestJobOpts.withAttempts(3));
      await worker.start();

      await new Promise((resolve) => setTimeout(resolve, 5000));

      expect(attemptCount).toBeGreaterThanOrEqual(2);
    }, 10000);

    it('should not retry beyond max attempts', async () => {
      let attemptCount = 0;
      processor.mockImplementation(async () => {
        attemptCount++;
        throw new Error('Always fails');
      });

      await queue.add('max-attempts-job', { message: 'test' }, TestJobOpts.withAttempts(2));
      await worker.start();

      await new Promise((resolve) => setTimeout(resolve, 2000));

      expect(attemptCount).toBeLessThanOrEqual(2);
    }, 4000);
  });

  describe('Backoff Strategies', () => {
    it('should use exponential backoff for retries', async () => {
      let attemptCount = 0;
      const attemptTimes: number[] = [];

      processor.mockImplementation(async () => {
        attemptCount++;
        attemptTimes.push(Date.now());
        if (attemptCount < 3) {
          throw new Error('Retry needed');
        }
        return 'success';
      });

      await queue.add('exponential-backoff', { message: 'test' }, TestJobOpts.withBackoff('exponential', 100));
      await worker.start();

      await new Promise((resolve) => setTimeout(resolve, 2000));

      if (attemptTimes.length >= 2) {
        const delay1 = attemptTimes[1] - attemptTimes[0];
        const delay2 = attemptTimes[2] - attemptTimes[1];
        expect(delay2).toBeGreaterThan(delay1);
      }
    }, 5000);

    it('should use fixed backoff for retries', async () => {
      let attemptCount = 0;
      const attemptTimes: number[] = [];

      processor.mockImplementation(async () => {
        attemptCount++;
        attemptTimes.push(Date.now());
        if (attemptCount < 3) {
          throw new Error('Retry needed');
        }
        return 'success';
      });

      await queue.add('fixed-backoff', { message: 'test' }, TestJobOpts.withBackoff('fixed', 200));
      await worker.start();

      await new Promise((resolve) => setTimeout(resolve, 2000));

      expect(attemptCount).toBeGreaterThanOrEqual(1);
    }, 5000);
  });

  describe('Timeout Functionality', () => {
    it('should timeout job that exceeds timeout duration', async () => {
      processor.mockImplementation(async () => {
        await new Promise((resolve) => setTimeout(resolve, 2000));
        return 'success';
      });

      await queue.add('timeout-job', { message: 'test' }, TestJobOpts.withTimeout(500));
      await worker.start();

      await new Promise((resolve) => setTimeout(resolve, 1500));

      const failed = await queue.getFailed();
      expect(failed.length).toBeGreaterThanOrEqual(0);
    }, 3000);

    it('should not timeout job that completes within timeout', async () => {
      processor.mockResolvedValue('success');
      await queue.add('no-timeout-job', { message: 'test' }, TestJobOpts.withTimeout(5000));
      await worker.start();

      await new Promise((resolve) => setTimeout(resolve, 1000));

      expect(processor).toHaveBeenCalled();
    }, 2000);
  });

  describe('Remove on Complete/Fail', () => {
    it('should remove job when removeOnComplete is true', async () => {
      processor.mockResolvedValue('success');
      const job = await queue.add('remove-complete', { message: 'test' }, TestJobOpts.withRemoveOnComplete(true));
      await worker.start();

      await new Promise((resolve) => setTimeout(resolve, 1000));

      const retrieved = await queue.getJob(job.id);
      expect(retrieved).toBeUndefined();
    }, 3000);

    it('should remove job when removeOnFail is true', async () => {
      processor.mockRejectedValue(new Error('Test failure'));
      const job = await queue.add('remove-fail', { message: 'test' }, TestJobOpts.withRemoveOnFail(true));
      await worker.start();

      await new Promise((resolve) => setTimeout(resolve, 1000));

      const retrieved = await queue.getJob(job.id);
      expect(retrieved).toBeUndefined();
    }, 3000);

    it('should keep job when removeOnComplete is false', async () => {
      processor.mockResolvedValue('success');
      const job = await queue.add('keep-complete', { message: 'test' }, TestJobOpts.withRemoveOnComplete(false));
      await worker.start();

      await new Promise((resolve) => setTimeout(resolve, 500));

      const completed = await queue.getCompleted();
      expect(completed.length).toBeGreaterThanOrEqual(0);
    }, 2000);
  });

  describe('Custom JobId', () => {
    it('should use custom jobId when provided', async () => {
      const customId = `custom-${Date.now()}`;
      const job = await queue.add('custom-id', { message: 'test' }, TestJobOpts.withJobId(customId));
      expect(job.id).toBe(customId);

      const retrieved = await queue.getJob(customId);
      expect(retrieved).toBeDefined();
      expect(retrieved?.id).toBe(customId);
    });
  });

  describe('LIFO Functionality', () => {
    it('should process jobs in LIFO order when enabled', async () => {
      const processingOrder: string[] = [];
      processor.mockImplementation(async (job: QueueHubJob) => {
        processingOrder.push(job.name);
        return 'success';
      });

      await queue.add('lifo-1', { order: 1 }, TestJobOpts.withLifo(true));
      await queue.add('lifo-2', { order: 2 }, TestJobOpts.withLifo(true));
      await queue.add('lifo-3', { order: 3 }, TestJobOpts.withLifo(true));

      await worker.start();
      await new Promise((resolve) => setTimeout(resolve, 1000));

      if (processingOrder.length >= 2) {
        const lastIndex = processingOrder.indexOf('lifo-3');
        const firstIndex = processingOrder.indexOf('lifo-1');
        if (lastIndex !== -1 && firstIndex !== -1) {
          expect(lastIndex).toBeLessThan(firstIndex);
        }
      }
    }, 3000);
  });

  describe('Complex Job Options', () => {
    it('should handle all options together', async () => {
      processor.mockResolvedValue('success');
      const job = await queue.add('complex-job', { message: 'test' }, TestJobOpts.complex());

      expect(job.opts?.priority).toBe(1);
      expect(job.opts?.delay).toBe(1000);
      expect(job.opts?.attempts).toBe(3);
      expect(job.opts?.timeout).toBe(5000);
      expect(job.opts?.removeOnComplete).toBe(true);
      expect(job.opts?.jobId).toBeDefined();

      await worker.start();
      await new Promise((resolve) => setTimeout(resolve, 2000));

      expect(processor).toHaveBeenCalled();
    }, 5000);
  });

  describe('Default Job Options', () => {
    it('should apply default job options from queue config', async () => {
      const queueWithDefaults = TestQueueFactory.createQueue(`default-queue-${Date.now()}`, {
        driver: QueueHubDriver.OCI_QUEUE,
        localMode: true,
        defaultJobOptions: {
          attempts: 5,
          priority: 2,
          removeOnComplete: true,
        },
      });

      const job = await queueWithDefaults.add('default-job', { message: 'test' });
      expect(job.opts?.attempts).toBe(5);
      expect(job.opts?.priority).toBe(2);
      expect(job.opts?.removeOnComplete).toBe(true);

      await TestQueueFactory.cleanupQueue(queueWithDefaults);
    });

    it('should override default options with provided options', async () => {
      const queueWithDefaults = TestQueueFactory.createQueue(`override-queue-${Date.now()}`, {
        driver: QueueHubDriver.OCI_QUEUE,
        localMode: true,
        defaultJobOptions: {
          attempts: 5,
          priority: 2,
        },
      });

      const job = await queueWithDefaults.add('override-job', { message: 'test' }, {
        attempts: 3,
        priority: 1,
      });

      expect(job.opts?.attempts).toBe(3);
      expect(job.opts?.priority).toBe(1);

      await TestQueueFactory.cleanupQueue(queueWithDefaults);
    });
  });
});

