import { SetMetadata } from '@nestjs/common';
import { NestQueueEventOptions } from '../interfaces/queue-event-options.interface';
import { QUEUE_EVENTS_LISTENER_METADATA } from '../queue-hub.constants';

export type QueueEventsListenerOptions = {
  queueName: string;
  queueEventsOptions?: NestQueueEventOptions;
};

/**
 * Represents a "QueueEvents" component (class that reacts to queue events).
 *
 * @publicApi
 */
export function QueueEventsListener(
  queueName: string,
  queueEventsOptions?: NestQueueEventOptions,
): ClassDecorator {
  return ((target: Function) => {
    SetMetadata(QUEUE_EVENTS_LISTENER_METADATA, {
      queueName,
      queueEventsOptions,
    })(target);
  }) as ClassDecorator;
}
