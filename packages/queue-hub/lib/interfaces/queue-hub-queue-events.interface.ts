import { EventEmitter } from 'events';

/**
 * @publicApi
 */
export interface QueueHubQueueEvents extends EventEmitter {
  close(): Promise<void>;
}

/**
 * @publicApi
 */
export interface QueueHubQueueEventsListener {
  waiting: (args: { jobId: string }) => void;
  active: (args: { jobId: string; prev?: string }) => void;
  completed: (args: { jobId: string; returnvalue: any; prev?: string }) => void;
  failed: (args: { jobId: string; failedReason: string; prev?: string }) => void;
  delayed: (args: { jobId: string; delay: number }) => void;
  progress: (args: { jobId: string; data: number | object }) => void;
  stalled: (args: { jobId: string }) => void;
  paused: () => void;
  resumed: () => void;
  removed: (args: { jobId: string }) => void;
  cleaned: (args: { jobs: string[]; type: string }) => void;
  drained: () => void;
  error: (error: Error) => void;
  closed: () => void;
}
