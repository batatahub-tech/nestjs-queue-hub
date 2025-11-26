import { FactoryProvider, ModuleMetadata, Provider, Type } from '@nestjs/common';
import { QueueHubQueueProcessor } from '../queue-hub.types';
import { OciQueueConnectionConfig } from './shared-queue-hub-config.interface';

/**
 * @publicApi
 */
export interface RegisterQueueOptions {
  connection?: OciQueueConnectionConfig;
  /**
   * Queue name
   *
   * @default default
   */
  name?: string;

  /**
   * Shared configuration key
   *
   * @default default
   */
  configKey?: string;

  /**
   * Additional queue processors
   */
  processors?: QueueHubQueueProcessor[];

  /**
   * When `true`, the queue will be force disconnected in the "onApplicationShutdown" lifecycle event.
   * Otherwise, the queue will be gracefully disconnected.
   * @default false
   */
  forceDisconnectOnShutdown?: boolean;
}

/**
 * @publicApi
 */
export interface RegisterQueueOptionsFactory {
  createRegisterQueueOptions(): Promise<RegisterQueueOptions> | RegisterQueueOptions;
}

/**
 * @publicApi
 */
export interface RegisterQueueAsyncOptions extends Pick<ModuleMetadata, 'imports'> {
  /**
   * Queue name.
   *
   * @default default
   */
  name?: string;

  /**
   * Shared configuration key.
   */
  configKey?: string;

  /**
   * Existing Provider to be used.
   */
  useExisting?: Type<RegisterQueueOptionsFactory>;

  /**
   * Type (class name) of provider (instance to be registered and injected).
   */
  useClass?: Type<RegisterQueueOptionsFactory>;

  /**
   * Factory function that returns an instance of the provider to be injected.
   */
  useFactory?: (...args: any[]) => Promise<RegisterQueueOptions> | RegisterQueueOptions;

  /**
   * Optional list of providers to be injected into the context of the Factory function.
   */
  inject?: FactoryProvider['inject'];

  /**
   * Extra providers to be registered in the module context.
   */
  extraProviders?: Provider[];
}
