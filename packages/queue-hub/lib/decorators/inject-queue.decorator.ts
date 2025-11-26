import { getQueueToken } from '@batatahub.com/nestjs-queue-hub-shared';
import { Inject } from '@nestjs/common';

/**
 * Injects QueueHub's queue instance with the given name
 * @param name queue name
 *
 * @publicApi
 */
export const InjectQueue = (name?: string): ReturnType<typeof Inject> =>
  Inject(getQueueToken(name));
