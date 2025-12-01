import { QueueHubJob } from '../../interfaces/queue-hub-job.interface';
import { QueueHubQueue } from '../../interfaces/queue-hub-queue.interface';
import { QueueHubWorker } from '../../interfaces/queue-hub-worker.interface';
import { QueueFactoryRegistry } from '../../drivers/queue-factory-registry';
import { QueueHubDriver } from '../../interfaces/shared-queue-hub-config.interface';

export interface TestWorkerConfig {
  driver: QueueHubDriver;
  localMode?: boolean;
  concurrency?: number;
  pollingInterval?: number;
}

export class TestWorkerFactory {
  static createWorker(
    name: string,
    queue: QueueHubQueue,
    processor: (job: QueueHubJob) => Promise<any>,
    config: TestWorkerConfig,
  ): QueueHubWorker {
    const effectiveDriver = config.localMode ? QueueHubDriver.LOCAL : config.driver;
    const factory = QueueFactoryRegistry.getFactory(effectiveDriver);

    return factory.createWorker(name, queue, processor, {
      concurrency: config.concurrency || 1,
      pollingInterval: config.pollingInterval || 100,
    });
  }

  static async cleanupWorker(worker: QueueHubWorker): Promise<void> {
    try {
      if (worker && typeof worker.close === 'function') {
        await worker.close(true);
        await new Promise((resolve) => setTimeout(resolve, 50));
      }
    } catch (error) {
    }
  }
}

