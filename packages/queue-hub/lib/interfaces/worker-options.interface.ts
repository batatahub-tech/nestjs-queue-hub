/**
 * @publicApi
 */
export interface NestWorkerOptions {
  concurrency?: number;
  limiter?: {
    max: number;
    duration: number;
  };
  maxStalledCount?: number;
  maxStalledCountInterval?: number;
  stalledInterval?: number;
  lockDuration?: number;
  lockRenewTime?: number;
  skipDelayedJobs?: boolean;
  skipLockedJobs?: boolean;
  skipStalledJobs?: boolean;
  removeOnComplete?: boolean | number | { count?: number; age?: number };
  removeOnFail?: boolean | number | { count?: number; age?: number };
  attempts?: number;
  backoff?: {
    type: 'fixed' | 'exponential';
    delay?: number;
  };
  delay?: number;
  jobId?: string;
}
