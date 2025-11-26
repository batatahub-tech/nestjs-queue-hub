import { QueueHubFlowProducer } from '../../interfaces/queue-hub-flow-producer.interface';
import { QueueHubJob } from '../../interfaces/queue-hub-job.interface';
import { OciQueueAdapter } from './oci-queue.adapter';

/**
 * Adapter for OCI Queue Flow Producer implementing QueueHubFlowProducer interface
 */
export class OciQueueFlowProducerAdapter implements QueueHubFlowProducer {
  constructor(private readonly queues: Map<string, OciQueueAdapter>) {}

  async add(flow: any, opts?: any): Promise<QueueHubJob> {
    const firstQueue = Array.from(this.queues.values())[0];
    if (!firstQueue) {
      throw new Error('No queues available for flow producer');
    }
    return firstQueue.add(flow.name || 'flow', flow.data || flow, opts);
  }

  async close(): Promise<void> {}
}
