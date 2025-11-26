import { OciQueueConnectionConfig } from './shared-queue-hub-config.interface';

/**
 * @publicApi
 */
export interface NestQueueEventOptions {
  connection?: OciQueueConnectionConfig;
  telemetry?: {
    enabled?: boolean;
    maxDataSize?: number;
  };
}
