import { QueueHubDriver } from '../../interfaces/shared-queue-hub-config.interface';
import { QueueHubQueue } from '../../interfaces/queue-hub-queue.interface';
import { QueueFactoryRegistry } from '../../drivers/queue-factory-registry';

export interface TestQueueConfig {
  driver: QueueHubDriver;
  localMode?: boolean;
  defaultJobOptions?: any;
  connection?: any;
  queueId?: string;
  endpoint?: string;
}

export class TestQueueFactory {
  static createQueue(
    name: string,
    config: TestQueueConfig,
  ): QueueHubQueue {
    const effectiveDriver = config.localMode ? QueueHubDriver.LOCAL : config.driver;
    const factory = QueueFactoryRegistry.getFactory(effectiveDriver);

    if (effectiveDriver === QueueHubDriver.LOCAL) {
      return factory.createQueue(name, {
        defaultJobOptions: config.defaultJobOptions,
      });
    }

    if (effectiveDriver === QueueHubDriver.OCI_QUEUE) {
      return factory.createQueue(name, {
        queueId: config.queueId || 'test-queue-id',
        endpoint: config.endpoint || 'https://test.queue.endpoint',
        region: 'us-ashburn-1',
        compartmentId: 'test-compartment-id',
        provider: config.connection?.provider || {
          getTenantId: () => 'test-tenant-id',
        },
        defaultJobOptions: config.defaultJobOptions,
      });
    }

    throw new Error(`Unsupported driver for testing: ${effectiveDriver}`);
  }

  static async cleanupQueue(queue: QueueHubQueue): Promise<void> {
    try {
      if (queue && typeof queue.close === 'function') {
        await queue.empty().catch(() => {});
        await queue.close().catch(() => {});
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
    } catch (error) {
    }
  }
}

