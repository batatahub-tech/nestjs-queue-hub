import { QueueHubJob } from './queue-hub-job.interface';

/**
 * @publicApi
 */
export interface QueueHubQueue<T = any, R = any> {
  name: string;
  add(name: string, data: T, opts?: any): Promise<QueueHubJob<T, R>>;
  getJob(jobId: string): Promise<QueueHubJob<T, R> | undefined>;
  getJobs(types?: string[], start?: number, end?: number): Promise<QueueHubJob<T, R>[]>;
  getWaiting(start?: number, end?: number): Promise<QueueHubJob<T, R>[]>;
  getActive(start?: number, end?: number): Promise<QueueHubJob<T, R>[]>;
  getCompleted(start?: number, end?: number): Promise<QueueHubJob<T, R>[]>;
  getFailed(start?: number, end?: number): Promise<QueueHubJob<T, R>[]>;
  getDelayed(start?: number, end?: number): Promise<QueueHubJob<T, R>[]>;
  getWaitingCount(): Promise<number>;
  getActiveCount(): Promise<number>;
  getCompletedCount(): Promise<number>;
  getFailedCount(): Promise<number>;
  getDelayedCount(): Promise<number>;
  pause(): Promise<void>;
  resume(): Promise<void>;
  clean(grace: number, limit: number, type?: string): Promise<any[]>;
  empty(): Promise<void>;
  close(): Promise<void>;
  remove(jobId: string): Promise<QueueHubJob<T, R> | undefined>;
  removeJobs(pattern: string): Promise<void>;
  obliterate(opts?: { force?: boolean }): Promise<void>;
}
