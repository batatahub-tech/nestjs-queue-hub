import { QueueHubJob } from './queue-hub-job.interface';

/**
 * @publicApi
 */
export interface QueueHubFlowProducer {
  add(flow: any, opts?: any): Promise<QueueHubJob>;
  close(): Promise<void>;
}
