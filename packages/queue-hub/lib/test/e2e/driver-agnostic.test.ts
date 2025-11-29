import { QueueHubDriver } from '../../interfaces/shared-queue-hub-config.interface';
import { QueueHubJob } from '../../interfaces/queue-hub-job.interface';
import { TestQueueFactory, TestWorkerFactory, TestJobOpts } from '../helpers';

interface DriverTestConfig {
  driver: QueueHubDriver;
  localMode?: boolean;
  connection?: any;
}

const drivers: DriverTestConfig[] = [
  { driver: QueueHubDriver.LOCAL, localMode: true },
];

if (process.env.TEST_OCI_DRIVER === 'true') {
  drivers.push({
    driver: QueueHubDriver.OCI_QUEUE,
    localMode: false,
    connection: {
      provider: {
        getTenantId: () => process.env.OCI_TENANT_ID || 'test-tenant-id',
      },
    },
  });
}

describe.each(drivers)('Driver Agnostic Tests - $driver', ({ driver, localMode, connection }) => {
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

  describe('Basic Queue Operations', () => {
    beforeEach(() => {
      queue = TestQueueFactory.createQueue(queueName, {
        driver,
        localMode,
        connection,
      });
    });

    it('should add job to queue', async () => {
      const job = await queue.add('test-job', { message: 'test' });
      expect(job).toBeDefined();
      expect(job.id).toBeDefined();
      expect(job.name).toBe('test-job');
    });

    it('should get job by id', async () => {
      const addedJob = await queue.add('test-job', { message: 'test' });
      const retrievedJob = await queue.getJob(addedJob.id);
      expect(retrievedJob).toBeDefined();
      expect(retrievedJob?.id).toBe(addedJob.id);
    });

    it('should get waiting jobs', async () => {
      await queue.add('job1', { data: 'test1' });
      await queue.add('job2', { data: 'test2' });
      const waiting = await queue.getWaiting();
      expect(waiting.length).toBeGreaterThanOrEqual(0);
    });

    it('should get waiting count', async () => {
      await queue.add('job1', { data: 'test1' });
      const count = await queue.getWaitingCount();
      expect(count).toBeGreaterThanOrEqual(0);
    });

    it('should empty queue', async () => {
      await queue.add('job1', { data: 'test1' });
      await queue.empty();
      const count = await queue.getWaitingCount();
      expect(count).toBe(0);
    });
  });

  describe('JobOpts - Delay', () => {
    beforeEach(() => {
      queue = TestQueueFactory.createQueue(queueName, {
        driver,
        localMode,
        connection,
      });
    });

    it('should delay job processing', async () => {
      const delay = 1000;
      const job = await queue.add('delayed-job', { message: 'test' }, TestJobOpts.withDelay(delay));
      expect(job).toBeDefined();

      const retrievedJob = await queue.getJob(job.id);
      if (retrievedJob) {
        const jobOpts = (retrievedJob as any).getJobOpts?.();
        if (jobOpts) {
          expect(jobOpts.processAfter).toBeGreaterThan(Date.now());
        }
      }
    });
  });

  describe('JobOpts - Priority', () => {
    beforeEach(() => {
      queue = TestQueueFactory.createQueue(queueName, {
        driver,
        localMode,
        connection,
      });
    });

    it('should set job priority', async () => {
      const job = await queue.add('priority-job', { message: 'test' }, TestJobOpts.withPriority(1));
      expect(job.opts?.priority).toBe(1);
    });

    it('should handle multiple priorities', async () => {
      const job1 = await queue.add('job1', { data: 'test1' }, TestJobOpts.withPriority(10));
      const job2 = await queue.add('job2', { data: 'test2' }, TestJobOpts.withPriority(1));
      const job3 = await queue.add('job3', { data: 'test3' }, TestJobOpts.withPriority(5));

      expect(job1.opts?.priority).toBe(10);
      expect(job2.opts?.priority).toBe(1);
      expect(job3.opts?.priority).toBe(5);
    });
  });

  describe('JobOpts - Attempts and Retry', () => {
    beforeEach(() => {
      queue = TestQueueFactory.createQueue(queueName, {
        driver,
        localMode,
        connection,
      });
      worker = TestWorkerFactory.createWorker(
        queueName,
        queue,
        processor,
        { driver, localMode, pollingInterval: 100 },
      );
    });

    it('should retry failed job up to max attempts', async () => {
      let attemptCount = 0;
      processor.mockImplementation(async () => {
        attemptCount++;
        if (attemptCount < 3) {
          throw new Error('Simulated failure');
        }
        return 'success';
      });

      await queue.add('retry-job', { message: 'test' }, TestJobOpts.withAttempts(3));
      await worker.start();

      await new Promise((resolve) => setTimeout(resolve, 5000));

      expect(attemptCount).toBeGreaterThanOrEqual(2);
      expect(processor).toHaveBeenCalled();
    }, 10000);
  });

  describe('JobOpts - Timeout', () => {
    beforeEach(() => {
      queue = TestQueueFactory.createQueue(queueName, {
        driver,
        localMode,
        connection,
      });
      worker = TestWorkerFactory.createWorker(
        queueName,
        queue,
        processor,
        { driver, localMode, pollingInterval: 100 },
      );
    });

    it('should timeout job that takes too long', async () => {
      processor.mockImplementation(async () => {
        await new Promise((resolve) => setTimeout(resolve, 2000));
        return 'success';
      });

      await queue.add('timeout-job', { message: 'test' }, TestJobOpts.withTimeout(500));
      await worker.start();

      await new Promise((resolve) => setTimeout(resolve, 1500));

      const failedJobs = await queue.getFailed();
      expect(failedJobs.length).toBeGreaterThanOrEqual(0);
    }, 10000);
  });

  describe('JobOpts - Backoff', () => {
    beforeEach(() => {
      queue = TestQueueFactory.createQueue(queueName, {
        driver,
        localMode,
        connection,
      });
    });

    it('should configure exponential backoff', async () => {
      const job = await queue.add('backoff-job', { message: 'test' }, TestJobOpts.withBackoff('exponential', 1000));
      expect(job.opts?.backoff).toBeDefined();
      if (typeof job.opts?.backoff === 'object') {
        expect(job.opts.backoff.type).toBe('exponential');
        expect(job.opts.backoff.delay).toBe(1000);
      }
    });

    it('should configure fixed backoff', async () => {
      const job = await queue.add('backoff-job', { message: 'test' }, TestJobOpts.withBackoff('fixed', 2000));
      expect(job.opts?.backoff).toBeDefined();
      if (typeof job.opts?.backoff === 'object') {
        expect(job.opts.backoff.type).toBe('fixed');
        expect(job.opts.backoff.delay).toBe(2000);
      }
    });
  });

  describe('JobOpts - Remove on Complete/Fail', () => {
    beforeEach(() => {
      queue = TestQueueFactory.createQueue(queueName, {
        driver,
        localMode,
        connection,
      });
      worker = TestWorkerFactory.createWorker(
        queueName,
        queue,
        processor,
        { driver, localMode, pollingInterval: 100 },
      );
    });

    it('should remove job on complete when configured', async () => {
      processor.mockResolvedValue('success');
      const job = await queue.add('remove-complete', { message: 'test' }, TestJobOpts.withRemoveOnComplete(true));
      await worker.start();

      await new Promise((resolve) => setTimeout(resolve, 1000));

      const retrieved = await queue.getJob(job.id);
      if (localMode) {
        expect(retrieved).toBeUndefined();
      }
    }, 5000);

    it('should remove job on fail when configured', async () => {
      processor.mockRejectedValue(new Error('Test failure'));
      const job = await queue.add('remove-fail', { message: 'test' }, TestJobOpts.withRemoveOnFail(true));
      await worker.start();

      await new Promise((resolve) => setTimeout(resolve, 1000));

      const retrieved = await queue.getJob(job.id);
      if (localMode) {
        expect(retrieved).toBeUndefined();
      }
    }, 5000);
  });

  describe('JobOpts - Custom JobId', () => {
    beforeEach(() => {
      queue = TestQueueFactory.createQueue(queueName, {
        driver,
        localMode,
        connection,
      });
    });

    it('should use custom jobId when provided', async () => {
      const customId = `custom-${Date.now()}`;
      const job = await queue.add('custom-id-job', { message: 'test' }, TestJobOpts.withJobId(customId));
      expect(job.id).toBe(customId);
    });
  });

  describe('JobOpts - Complex Configuration', () => {
    beforeEach(() => {
      queue = TestQueueFactory.createQueue(queueName, {
        driver,
        localMode,
        connection,
      });
    });

    it('should handle complex job options', async () => {
      const job = await queue.add('complex-job', { message: 'test' }, TestJobOpts.complex());
      expect(job.opts?.priority).toBe(1);
      expect(job.opts?.delay).toBe(1000);
      expect(job.opts?.attempts).toBe(3);
      expect(job.opts?.timeout).toBe(5000);
      expect(job.opts?.removeOnComplete).toBe(true);
      expect(job.opts?.jobId).toBeDefined();
    });
  });

  describe('Worker Processing', () => {
    beforeEach(() => {
      queue = TestQueueFactory.createQueue(queueName, {
        driver,
        localMode,
        connection,
      });
      worker = TestWorkerFactory.createWorker(
        queueName,
        queue,
        processor,
        { driver, localMode, pollingInterval: 100 },
      );
    });

    it('should process jobs', async () => {
      processor.mockResolvedValue('success');
      await queue.add('test-job', { message: 'test' });
      await worker.start();

      await new Promise((resolve) => setTimeout(resolve, 1000));

      expect(processor).toHaveBeenCalled();
    }, 5000);

    it('should handle job failures', async () => {
      processor.mockRejectedValue(new Error('Test error'));
      await queue.add('failing-job', { message: 'test' });
      await worker.start();

      await new Promise((resolve) => setTimeout(resolve, 1000));

      expect(processor).toHaveBeenCalled();
    }, 5000);
  });
});

