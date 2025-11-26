import { SetMetadata } from '@nestjs/common';
import { QueueHubQueueEventsListener } from '../interfaces/queue-hub-queue-events.interface';
import { ON_QUEUE_EVENT_METADATA } from '../queue-hub.constants';

/**
 * @publicApi
 */
export interface OnQueueEventMetadata {
  eventName: keyof QueueHubQueueEventsListener;
}

/**
 * Registers a queue event listener.
 * Class that contains queue event listeners must be annotated
 * with the "QueueEventsListener" decorator.
 *
 * @publicApi
 */
export const OnQueueEvent = (eventName: keyof QueueHubQueueEventsListener): MethodDecorator =>
  SetMetadata(ON_QUEUE_EVENT_METADATA, { eventName } as OnQueueEventMetadata);
