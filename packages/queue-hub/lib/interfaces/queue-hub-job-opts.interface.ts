/**
 * Backoff options for automatic retries
 * @publicApi
 */
export interface BackoffOpts {
  /**
   * Backoff type, which can be either `fixed` or `exponential`.
   * A custom backoff strategy can also be specified in `backoffStrategies` on the queue settings.
   */
  type: string;
  /**
   * Backoff delay, in milliseconds.
   */
  delay: number;
}

/**
 * Repeat options for recurring jobs
 * @publicApi
 */
export interface RepeatOpts {
  /**
   * Cron string
   */
  cron?: string;
  /**
   * Timezone
   */
  tz?: string;
  /**
   * Start date when the repeat job should start repeating (only with cron).
   */
  startDate?: Date | string | number;
  /**
   * End date when the repeat job should stop repeating.
   */
  endDate?: Date | string | number;
  /**
   * Number of times the job should repeat at max.
   */
  limit?: number;
  /**
   * Repeat every millis (cron setting cannot be used together with this setting.)
   */
  every?: number;
  /**
   * The start value for the repeat iteration count.
   */
  count?: number;
}

/**
 * Job options for queue operations
 * @publicApi
 */
export interface JobOpts {
  /**
   * Optional priority value. ranges from 1 (highest priority) to MAX_INT (lowest priority).
   * Note that using priorities has a slight impact on performance, so do not use it if not required.
   */
  priority?: number;
  /**
   * An amount of miliseconds to wait until this job can be processed.
   * Note that for accurate delays, both server and clients should have their clocks synchronized.
   */
  delay?: number;
  /**
   * The total number of attempts to try the job until it completes.
   */
  attempts?: number;
  /**
   * Repeat job according to a cron specification.
   */
  repeat?: RepeatOpts;
  /**
   * Backoff setting for automatic retries if the job fails
   */
  backoff?: number | BackoffOpts;
  /**
   * If true, adds the job to the right of the queue instead of the left (default false)
   */
  lifo?: boolean;
  /**
   * The number of milliseconds after which the job should be fail with a timeout error
   */
  timeout?: number;
  /**
   * Override the job ID - by default, the job ID is a unique integer, but you can use this setting to override it.
   * If you use this option, it is up to you to ensure the jobId is unique.
   * If you attempt to add a job with an id that already exists, it will not be added.
   */
  jobId?: number | string;
  /**
   * If true, removes the job when it successfully completes.
   * A number specified the amount of jobs to keep.
   * Default behavior is to keep the job in the completed set.
   */
  removeOnComplete?: boolean | number;
  /**
   * If true, removes the job when it fails after all attempts.
   * A number specified the amount of jobs to keep.
   * Default behavior is to keep the job in the failed set.
   */
  removeOnFail?: boolean | number;
  /**
   * Limits the amount of stack trace lines that will be recorded in the stacktrace.
   */
  stackTraceLimit?: number;
}

