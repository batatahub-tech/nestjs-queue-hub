import { BackoffOpts, JobOpts } from '../../interfaces/queue-hub-job-opts.interface';

export const TestJobOpts = {
  withDelay: (delayMs: number): JobOpts => ({
    delay: delayMs,
  }),

  withPriority: (priority: number): JobOpts => ({
    priority,
  }),

  withAttempts: (attempts: number, backoff?: number | BackoffOpts): JobOpts => ({
    attempts,
    backoff: backoff || {
      type: 'exponential',
      delay: 1000,
    },
  }),

  withTimeout: (timeoutMs: number): JobOpts => ({
    timeout: timeoutMs,
  }),

  withBackoff: (type: 'fixed' | 'exponential', delay: number): JobOpts => ({
    attempts: 3,
    backoff: {
      type,
      delay,
    },
  }),

  withRemoveOnComplete: (remove: boolean): JobOpts => ({
    removeOnComplete: remove,
  }),

  withRemoveOnFail: (remove: boolean): JobOpts => ({
    removeOnFail: remove,
    attempts: 1,
  }),

  withJobId: (jobId: string | number): JobOpts => ({
    jobId,
  }),

  withLifo: (lifo: boolean): JobOpts => ({
    lifo,
  }),

  complex: (): JobOpts => ({
    priority: 1,
    delay: 1000,
    attempts: 3,
    timeout: 5000,
    backoff: {
      type: 'exponential',
      delay: 1000,
    },
    removeOnComplete: true,
    jobId: `test-${Date.now()}`,
  }),
};

