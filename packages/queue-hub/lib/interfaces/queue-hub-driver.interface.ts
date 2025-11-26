/**
 * Available queue drivers
 * @publicApi
 */
export enum QueueHubDriver {
  OCI_QUEUE = 'oci-queue',
}

/**
 * Queue factory interface that all driver factories must implement
 * @publicApi
 */
export interface QueueHubFactory {
  createQueue(name: string, config: any): any;
  createWorker(name: string, queue: any, processor: any, options?: any): any;
  createQueueEvents(queue: any): any;
  createFlowProducer(queues: Map<string, any>): any;
}
