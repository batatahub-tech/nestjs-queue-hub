import { SetMetadata } from '@nestjs/common';
import { QueueHubWorkerListener } from '../interfaces/queue-hub-worker.interface';
import { ON_WORKER_EVENT_METADATA } from '../queue-hub.constants';

/**
 * @publicApi
 */
export interface OnWorkerEventMetadata {
  eventName: keyof QueueHubWorkerListener;
}

/**
 * Registers a worker event listener.
 * Class that contains worker event listeners must be annotated
 * with the "Processor" decorator.
 *
 * @publicApi
 */
export const OnWorkerEvent = (eventName: keyof QueueHubWorkerListener): MethodDecorator =>
  SetMetadata(ON_WORKER_EVENT_METADATA, {
    eventName: eventName,
  } as OnWorkerEventMetadata);
