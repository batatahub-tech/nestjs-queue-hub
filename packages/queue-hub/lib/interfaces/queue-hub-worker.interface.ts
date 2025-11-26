import { EventEmitter } from 'events';
import { QueueHubJob } from './queue-hub-job.interface';

/**
 * @publicApi
 */
export interface QueueHubWorker extends EventEmitter {
  name: string;
  close(force?: boolean): Promise<void>;
  isRunning(): boolean;
  isPaused(): boolean;
  pause(force?: boolean): Promise<void>;
  resume(): Promise<void>;
}

/**
 * @publicApi
 */
export interface QueueHubWorkerListener {
  completed: (job: QueueHubJob, result: any, prev: string) => void;
  active: (job: QueueHubJob, prev: string) => void;
  error: (error: Error) => void;
  failed: (job: QueueHubJob, error: Error, prev: string) => void;
  progress: (job: QueueHubJob, progress: number | object) => void;
  stalled: (jobId: string) => void;
  closing: () => void;
  closed: () => void;
}
