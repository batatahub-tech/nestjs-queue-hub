import * as common from 'oci-common';
import { QueueClient } from 'oci-queue';
import { QueueHubFlowProducer } from '../../interfaces/queue-hub-flow-producer.interface';
import { QueueHubJob } from '../../interfaces/queue-hub-job.interface';
import { QueueHubQueueEvents } from '../../interfaces/queue-hub-queue-events.interface';
import { QueueHubQueue } from '../../interfaces/queue-hub-queue.interface';
import { QueueHubWorker } from '../../interfaces/queue-hub-worker.interface';
import { QueueHubQueueProcessor } from '../../queue-hub.types';
import {
  isAdvancedProcessor,
  isAdvancedSeparateProcessor,
  isProcessorCallback,
  isSeparateProcessor,
} from '../../utils/helpers';
import { QueueHubLogger } from '../../utils/logger';
import { OciQueueEventsAdapter } from './oci-queue-events.adapter';
import { OciQueueFlowProducerAdapter } from './oci-queue-flow-producer.adapter';
import { OciQueueWorkerAdapter } from './oci-queue-worker.adapter';
import { OciQueueAdapter } from './oci-queue.adapter';

export interface OciQueueConfig {
  provider: common.ConfigFileAuthenticationDetailsProvider;
  compartmentId: string;
  queueId: string;
  region?: string;
  endpoint?: string;
}

export class OciQueueFactory {
  private static queueClients = new Map<string, QueueClient>();
  private static queues = new Map<string, OciQueueAdapter>();
  private static readonly logger = new QueueHubLogger('OciQueueFactory');

  static createQueueClient(config: OciQueueConfig): QueueClient {
    const key = `${config.queueId}-${config.region || 'default'}`;

    if (!OciQueueFactory.queueClients.has(key)) {
      OciQueueFactory.logger.debug(`Creating new QueueClient for queue ${config.queueId}`);

      const clientConfig: {
        authenticationDetailsProvider: common.AuthenticationDetailsProvider;
      } = {
        authenticationDetailsProvider: config.provider,
      };

      const client = new QueueClient(clientConfig);

      if (config.endpoint) {
        client.endpoint = config.endpoint;
      }

      OciQueueFactory.queueClients.set(key, client);
      OciQueueFactory.logger.debug(`QueueClient created and cached for queue ${config.queueId}`);
    } else {
      OciQueueFactory.logger.debug(`Using cached QueueClient for queue ${config.queueId}`);
    }

    const client = OciQueueFactory.queueClients.get(key);
    if (!client) {
      throw new Error(`QueueClient not found for key: ${key}`);
    }
    return client;
  }

  static createQueue(name: string, config: OciQueueConfig): QueueHubQueue {
    const key = `${name}-${config.queueId}`;

    if (!OciQueueFactory.queues.has(key)) {
      const client = OciQueueFactory.createQueueClient(config);
      const queue = new OciQueueAdapter(name, client, config.queueId);
      OciQueueFactory.queues.set(key, queue);
    }

    const queue = OciQueueFactory.queues.get(key);
    if (!queue) {
      throw new Error(`Queue not found for key: ${key}`);
    }
    return queue;
  }

  static createWorker(
    name: string,
    queue: QueueHubQueue,
    processor: QueueHubQueueProcessor,
    options?: {
      concurrency?: number;
      visibilityTimeout?: number;
      pollingInterval?: number;
    },
  ): QueueHubWorker {
    let processorFn: (job: QueueHubJob) => Promise<any>;

    if (isAdvancedProcessor(processor)) {
      processorFn = processor.callback;
    } else if (isAdvancedSeparateProcessor(processor)) {
      throw new Error('Separate processors not supported with OCI Queue');
    } else if (isSeparateProcessor(processor)) {
      throw new Error('Separate processors not supported with OCI Queue');
    } else if (isProcessorCallback(processor)) {
      processorFn = processor;
    } else {
      throw new Error('Invalid processor type');
    }

    const worker = new OciQueueWorkerAdapter(name, queue as OciQueueAdapter, processorFn, options);

    OciQueueFactory.logger.debug(`Worker "${name}" created for queue "${queue.name}"`);

    setTimeout(() => {
      worker.start().catch((error) => {
        console.error(`[OciQueueFactory] Failed to start worker "${name}":`, error);
        console.error('[OciQueueFactory] Error stack:', error?.stack);
      });
    }, 100);

    return worker;
  }

  static createQueueEvents(queue: QueueHubQueue): QueueHubQueueEvents {
    return new OciQueueEventsAdapter(queue as OciQueueAdapter);
  }

  static createFlowProducer(queues: Map<string, QueueHubQueue>): QueueHubFlowProducer {
    const ociQueues = new Map<string, OciQueueAdapter>();
    queues.forEach((queue, name) => {
      ociQueues.set(name, queue as OciQueueAdapter);
    });
    return new OciQueueFlowProducerAdapter(ociQueues);
  }
}
