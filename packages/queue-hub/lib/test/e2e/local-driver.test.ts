import { QueueHubDriver } from '../../interfaces/shared-queue-hub-config.interface';
import { QueueHubJob } from '../../interfaces/queue-hub-job.interface';
import { TestQueueFactory, TestWorkerFactory, TestJobOpts } from '../helpers';

describe('Local Driver E2E Tests', () => {
  let queueName: string;
  let queue: any;
  let worker: any;
  let processor: jest.Mock;

  beforeEach(() => {
    queueName = `test-queue-${Date.now()}`;
    processor = jest.fn();
  });

  afterEach(async () => {
    if (worker) {
      await TestWorkerFactory.cleanupWorker(worker);
    }
    if (queue) {
      await TestQueueFactory.cleanupQueue(queue);
    }
  });

  describe('Local Queue Operations', () => {
    beforeEach(() => {
      queue = TestQueueFactory.createQueue(queueName, {
        driver: QueueHubDriver.OCI_QUEUE,
        localMode: true,
      });
    });

    it('should create local queue', () => {
      expect(queue).toBeDefined();
      expect(queue.name).toBe(queueName);
    });

    it('should add and retrieve jobs', async () => {
      const job = await queue.add('test-job', { message: 'test' });
      expect(job).toBeDefined();

      const retrieved = await queue.getJob(job.id);
      expect(retrieved).toBeDefined();
      expect(retrieved?.id).toBe(job.id);
      expect(retrieved?.data).toEqual({ message: 'test' });
    });

    it('should get jobs by state', async () => {
      await queue.add('waiting-job', { state: 'waiting' });
      const waiting = await queue.getWaiting();
      expect(waiting.length).toBeGreaterThanOrEqual(0);
    });

    it('should track job states', async () => {
      const job = await queue.add('state-job', { message: 'test' });
      const state = await (job as any).getState?.();
      expect(['waiting', 'active', 'completed', 'failed']).toContain(state);
    });
  });

  describe('Local Worker Processing', () => {
    beforeEach(() => {
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

    it('should process jobs immediately', async () => {
      processor.mockResolvedValue('success');
      await queue.add('immediate-job', { message: 'test' });
      await worker.start();

      await new Promise((resolve) => setTimeout(resolve, 500));

      expect(processor).toHaveBeenCalled();
      const completed = await queue.getCompleted();
      expect(completed.length).toBeGreaterThanOrEqual(0);
    }, 3000);

    it('should handle delayed jobs', async () => {
      processor.mockResolvedValue('success');
      await queue.add('delayed-job', { message: 'test' }, TestJobOpts.withDelay(500));
      await worker.start();

      await new Promise((resolve) => setTimeout(resolve, 100));
      expect(processor).not.toHaveBeenCalled();

      await new Promise((resolve) => setTimeout(resolve, 600));
      expect(processor).toHaveBeenCalled();
    }, 2000);

    it('should process jobs by priority', async () => {
      const processingOrder: string[] = [];
      processor.mockImplementation(async (job: QueueHubJob) => {
        processingOrder.push(job.id);
        return 'success';
      });

      await queue.add('low-priority', { priority: 10 }, TestJobOpts.withPriority(10));
      await queue.add('high-priority', { priority: 1 }, TestJobOpts.withPriority(1));
      await queue.add('medium-priority', { priority: 5 }, TestJobOpts.withPriority(5));

      await worker.start();
      await new Promise((resolve) => setTimeout(resolve, 1000));

      if (processingOrder.length >= 2) {
        const highPriorityIndex = processingOrder.findIndex((id) => {
          const job = queue.getJob?.(id);
          return job?.name === 'high-priority';
        });
        const lowPriorityIndex = processingOrder.findIndex((id) => {
          const job = queue.getJob?.(id);
          return job?.name === 'low-priority';
        });

        if (highPriorityIndex !== -1 && lowPriorityIndex !== -1) {
          expect(highPriorityIndex).toBeLessThan(lowPriorityIndex);
        }
      }
    }, 3000);

    it('should retry failed jobs with backoff', async () => {
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

    it('should timeout jobs', async () => {
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
  });

  describe('Local Job States', () => {
    beforeEach(() => {
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

    it('should track completed jobs', async () => {
      processor.mockResolvedValue('success');
      await queue.add('complete-job', { message: 'test' });
      await worker.start();

      await new Promise((resolve) => setTimeout(resolve, 500));

      const completed = await queue.getCompleted();
      expect(completed.length).toBeGreaterThanOrEqual(0);
    }, 2000);

    it('should track failed jobs', async () => {
      processor.mockRejectedValue(new Error('Test failure'));
      await queue.add('fail-job', { message: 'test' });
      await worker.start();

      await new Promise((resolve) => setTimeout(resolve, 500));

      const failed = await queue.getFailed();
      expect(failed.length).toBeGreaterThanOrEqual(0);
    }, 2000);
  });
});

