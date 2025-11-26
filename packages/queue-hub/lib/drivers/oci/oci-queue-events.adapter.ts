import { EventEmitter } from 'events';
import {
  QueueHubQueueEvents,
  QueueHubQueueEventsListener,
} from '../../interfaces/queue-hub-queue-events.interface';
import { OciQueueAdapter } from './oci-queue.adapter';

/**
 * Adapter for OCI Queue Events implementing QueueHubQueueEvents interface
 */
export class OciQueueEventsAdapter extends EventEmitter implements QueueHubQueueEvents {
  private pollingInterval?: NodeJS.Timeout;

  constructor(private readonly queue: OciQueueAdapter) {
    super();
    this.startPolling();
  }

  private startPolling(): void {
    this.pollingInterval = setInterval(async () => {
      try {
        const waiting = await this.queue.getWaitingCount();
        const active = await this.queue.getActiveCount();

        if (waiting > 0) {
          this.emit('waiting', { jobId: 'unknown' });
        }

        if (active > 0) {
          this.emit('active', { jobId: 'unknown' });
        }
      } catch (error) {
        this.emit('error', error as Error);
      }
    }, 1000);
  }

  async close(): Promise<void> {
    if (this.pollingInterval) {
      clearInterval(this.pollingInterval);
    }
    this.emit('closed');
  }
}
