/**
 * Advanced Queue configuration settings
 * These should usually not be changed.
 * @publicApi
 */
export interface AdvancedSettings {
  /**
   * Key expiration time for job locks.
   * @default 30000
   */
  lockDuration?: number;
  /**
   * Interval on which to acquire the job lock
   * @default 15000
   */
  lockRenewTime?: number;
  /**
   * How often check for stalled jobs (use 0 for never checking).
   * @default 30000
   */
  stalledInterval?: number;
  /**
   * Max amount of times a stalled job will be re-processed.
   * @default 1
   */
  maxStalledCount?: number;
  /**
   * Poll interval for delayed jobs and added jobs.
   * @default 5000
   */
  guardInterval?: number;
  /**
   * Delay before processing next job in case of internal error.
   * @default 5000
   */
  retryProcessDelay?: number;
  /**
   * A set of custom backoff strategies keyed by name.
   */
  backoffStrategies?: Record<string, any>;
  /**
   * A timeout for when the queue is in drained state (empty waiting for jobs).
   * @default 5
   */
  drainDelay?: number;
}

