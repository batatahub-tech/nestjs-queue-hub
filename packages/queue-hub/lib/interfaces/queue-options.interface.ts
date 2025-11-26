import { OciQueueConnectionConfig } from './shared-queue-hub-config.interface';

/**
 * @publicApi
 */
export interface NestQueueOptions {
  connection?: OciQueueConnectionConfig;
  defaultJobOptions?: {
    attempts?: number;
    backoff?: {
      type: 'fixed' | 'exponential';
      delay?: number;
    };
    delay?: number;
    removeOnComplete?: boolean | number | { count?: number; age?: number };
    removeOnFail?: boolean | number | { count?: number; age?: number };
  };
  settings?: {
    maxStalledCount?: number;
    retryProcessDelay?: number;
  };
}
