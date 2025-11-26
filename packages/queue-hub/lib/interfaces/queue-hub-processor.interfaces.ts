import { QueueHubQueueProcessorCallback, QueueHubQueueSeparateProcessor } from '../queue-hub.types';
import { NestWorkerOptions } from './worker-options.interface';

/**
 * @publicApi
 */
export interface QueueHubQueueAdvancedProcessor extends Partial<NestWorkerOptions> {
  concurrency?: number;
  callback: QueueHubQueueProcessorCallback;
}

export interface QueueHubQueueAdvancedSeparateProcessor extends Partial<NestWorkerOptions> {
  concurrency?: number;
  path: QueueHubQueueSeparateProcessor;
  useWorkerThreads?: boolean;
}
