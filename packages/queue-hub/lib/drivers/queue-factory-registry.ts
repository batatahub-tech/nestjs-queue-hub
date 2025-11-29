import { QueueHubDriver } from '../interfaces/shared-queue-hub-config.interface';
import { LocalQueueFactory } from './local/local-queue-factory';
import { OciQueueFactory } from './oci/oci-queue-factory';

export interface QueueFactory {
  createQueue(name: string, config: any): any;
  createWorker(name: string, queue: any, processor: any, options?: any): any;
  createQueueEvents(queue: any): any;
  createFlowProducer(queues: Map<string, any>): any;
}

export class QueueFactoryRegistry {
  private static factories = new Map<QueueHubDriver, QueueFactory>();

  static {
    QueueFactoryRegistry.factories.set(QueueHubDriver.OCI_QUEUE, OciQueueFactory);
    QueueFactoryRegistry.factories.set(QueueHubDriver.LOCAL, LocalQueueFactory);
  }

  static getFactory(driver: QueueHubDriver = QueueHubDriver.OCI_QUEUE): QueueFactory {
    const factory = QueueFactoryRegistry.factories.get(driver);
    if (!factory) {
      throw new Error(
        `Queue driver "${driver}" is not supported. Available drivers: ${Array.from(QueueFactoryRegistry.factories.keys()).join(', ')}`,
      );
    }
    return factory;
  }

  static registerFactory(driver: QueueHubDriver, factory: QueueFactory): void {
    QueueFactoryRegistry.factories.set(driver, factory);
  }
}
