import { JobOpts } from '../../interfaces/queue-hub-job-opts.interface';
import { QueueHubFlowProducer } from '../../interfaces/queue-hub-flow-producer.interface';
import { QueueHubJob } from '../../interfaces/queue-hub-job.interface';
import { QueueHubQueue } from '../../interfaces/queue-hub-queue.interface';
import { QueueHubQueueEvents } from '../../interfaces/queue-hub-queue-events.interface';
import { QueueHubWorker } from '../../interfaces/queue-hub-worker.interface';
import { LocalQueueAdapter } from './local-queue.adapter';
import { LocalQueueWorkerAdapter } from './local-queue-worker.adapter';

export interface LocalQueueConfig {
  defaultJobOptions?: JobOpts;
}

export class LocalQueueFactory {
  private static queues = new Map<string, QueueHubQueue>();
  private static workers = new Map<string, QueueHubWorker[]>();

  static createQueue(name: string, config: LocalQueueConfig): QueueHubQueue {
    const key = name;

    if (!LocalQueueFactory.queues.has(key)) {
      const queue = new LocalQueueAdapter(name, config.defaultJobOptions);
      LocalQueueFactory.queues.set(key, queue);
    }

    const queue = LocalQueueFactory.queues.get(key);
    if (!queue) {
      throw new Error(`Queue not found for key: ${key}`);
    }
    return queue;
  }

  static createWorker(
    name: string,
    queue: QueueHubQueue,
    processor: (job: QueueHubJob) => Promise<any>,
    options?: {
      concurrency?: number;
      visibilityTimeout?: number;
      pollingInterval?: number;
    },
  ): QueueHubWorker {
    const worker = new LocalQueueWorkerAdapter(
      name,
      queue as LocalQueueAdapter,
      processor,
      options,
    );

    if (!LocalQueueFactory.workers.has(name)) {
      LocalQueueFactory.workers.set(name, []);
    }
    LocalQueueFactory.workers.get(name)?.push(worker);

    return worker;
  }

  static createQueueEvents(_queue: QueueHubQueue): QueueHubQueueEvents {
    return {
      on: () => {},
      once: () => {},
      off: () => {},
      removeListener: () => {},
      removeAllListeners: () => {},
      emit: () => false,
    } as QueueHubQueueEvents;
  }

  static createFlowProducer(_queues: Map<string, QueueHubQueue>): QueueHubFlowProducer {
    return {
      add: async () => {
        throw new Error('FlowProducer not implemented for local driver');
      },
    } as QueueHubFlowProducer;
  }
}

