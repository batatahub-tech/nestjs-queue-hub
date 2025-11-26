import { URL } from 'url';
import { QueueHubJob } from './interfaces/queue-hub-job.interface';
import {
  QueueHubQueueAdvancedProcessor,
  QueueHubQueueAdvancedSeparateProcessor,
} from './interfaces/queue-hub-processor.interfaces';

export type QueueHubQueueProcessor =
  | QueueHubQueueProcessorCallback
  | QueueHubQueueAdvancedProcessor
  | QueueHubQueueSeparateProcessor
  | QueueHubQueueAdvancedSeparateProcessor;

export type QueueHubQueueProcessorCallback = (job: QueueHubJob) => Promise<unknown>;

export type QueueHubQueueSeparateProcessor = string | URL;
