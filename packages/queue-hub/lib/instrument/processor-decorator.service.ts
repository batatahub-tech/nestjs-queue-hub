import { Injectable } from '@nestjs/common';
import { QueueHubJob } from '../interfaces/queue-hub-job.interface';

export type ProcessorFunction = (job: QueueHubJob) => Promise<unknown>;

@Injectable()
export class ProcessorDecoratorService {
  /**
   * Decorates a processor function.
   * This method can be overridden to provide custom behavior for processor decoration.
   *
   * @param processor The processor function to decorate
   * @returns The decorated processor function
   */
  decorate(processor: ProcessorFunction): ProcessorFunction {
    return processor;
  }
}
