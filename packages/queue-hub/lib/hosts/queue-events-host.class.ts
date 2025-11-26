import { OnApplicationShutdown } from '@nestjs/common';
import { QueueHubQueueEvents } from '../interfaces/queue-hub-queue-events.interface';

export abstract class QueueEventsHost<T extends QueueHubQueueEvents = QueueHubQueueEvents>
  implements OnApplicationShutdown
{
  private _queueEvents: T | undefined;

  get queueEvents(): T {
    if (!this._queueEvents) {
      throw new Error(
        '"QueueEvents" class has not yet been initialized. Make sure to interact with queue events instances after the "onModuleInit" lifecycle hook is triggered, for example, in the "onApplicationBootstrap" hook, or if "manualRegistration" is set to true make sure to call "QueueHubRegistrar.register()"',
      );
    }
    return this._queueEvents;
  }

  onApplicationShutdown(_signal?: string) {
    return this._queueEvents?.close();
  }
}
