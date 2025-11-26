import { Injectable, Type } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import {
  OnQueueEventMetadata,
  OnWorkerEventMetadata,
  ProcessorOptions,
  QueueEventsListenerOptions,
} from './decorators';
import { NestWorkerOptions } from './interfaces/worker-options.interface';
import {
  ON_QUEUE_EVENT_METADATA,
  ON_WORKER_EVENT_METADATA,
  PROCESSOR_METADATA,
  QUEUE_EVENTS_LISTENER_METADATA,
  WORKER_METADATA,
} from './queue-hub.constants';

@Injectable()
export class QueueHubMetadataAccessor {
  constructor(private readonly reflector: Reflector) {}

  isProcessor(target: Type<any> | (new (...args: any[]) => any) | Function): boolean {
    if (!target) {
      return false;
    }
    return !!this.reflector.get(PROCESSOR_METADATA, target);
  }

  isQueueEventsListener(target: Type<any> | (new (...args: any[]) => any) | Function): boolean {
    if (!target) {
      return false;
    }
    return !!this.reflector.get(QUEUE_EVENTS_LISTENER_METADATA, target);
  }

  getProcessorMetadata(
    target: Type<any> | (new (...args: any[]) => any) | Function,
  ): ProcessorOptions | undefined {
    return this.reflector.get(PROCESSOR_METADATA, target);
  }

  getWorkerOptionsMetadata(
    target: Type<any> | (new (...args: any[]) => any) | Function,
  ): NestWorkerOptions {
    return this.reflector.get(WORKER_METADATA, target) ?? {};
  }

  getOnQueueEventMetadata(
    target: Type<any> | (new (...args: any[]) => any) | Function,
  ): OnQueueEventMetadata | undefined {
    return this.reflector.get(ON_QUEUE_EVENT_METADATA, target);
  }

  getOnWorkerEventMetadata(
    target: Type<any> | (new (...args: any[]) => any) | Function,
  ): OnWorkerEventMetadata | undefined {
    return this.reflector.get(ON_WORKER_EVENT_METADATA, target);
  }

  getQueueEventsListenerMetadata(
    target: Type<any> | (new (...args: any[]) => any) | Function,
  ): QueueEventsListenerOptions | undefined {
    return this.reflector.get(QUEUE_EVENTS_LISTENER_METADATA, target);
  }
}
