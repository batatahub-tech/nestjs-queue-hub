import { NO_QUEUE_FOUND, getQueueToken } from '@batatahub.com/nestjs-queue-hub-shared';
import { Injectable, Logger, OnApplicationShutdown, Type } from '@nestjs/common';
import { ContextIdFactory, DiscoveryService, MetadataScanner, ModuleRef } from '@nestjs/core';
import { Injector } from '@nestjs/core/injector/injector';
import { InstanceWrapper } from '@nestjs/core/injector/instance-wrapper';
import { Module } from '@nestjs/core/injector/module';
import { REQUEST_CONTEXT_ID } from '@nestjs/core/router/request/request-constants';
import { OnQueueEventMetadata, OnWorkerEventMetadata } from './decorators';
import { InvalidProcessorClassError, InvalidQueueEventsListenerClassError } from './errors';
import { QueueEventsHost, WorkerHost } from './hosts';
import {
  ProcessorDecoratorService,
  ProcessorFunction,
} from './instrument/processor-decorator.service';
import {
  QueueHubFlowProducer,
  QueueHubJob,
  QueueHubQueue,
  QueueHubQueueEvents,
  QueueHubRootModuleOptions,
  QueueHubWorker,
} from './interfaces';
import { NestQueueOptions } from './interfaces/queue-options.interface';
import { NestWorkerOptions } from './interfaces/worker-options.interface';
import { QueueHubMetadataAccessor } from './queue-hub-metadata.accessor';
import { NO_FLOW_PRODUCER_FOUND } from './queue-hub.messages';
import { QUEUE_HUB_CONFIG_DEFAULT_TOKEN, getSharedConfigToken } from './utils';

@Injectable()
export class QueueHubExplorer implements OnApplicationShutdown {
  private readonly logger = new Logger('QueueHubModule');
  private readonly injector = new Injector();
  private readonly workers: QueueHubWorker[] = [];

  constructor(
    private readonly moduleRef: ModuleRef,
    private readonly discoveryService: DiscoveryService,
    private readonly metadataAccessor: QueueHubMetadataAccessor,
    private readonly metadataScanner: MetadataScanner,
    private readonly processorDecoratorService: ProcessorDecoratorService,
  ) {}

  onApplicationShutdown(_signal?: string) {
    return Promise.all(this.workers.map((worker) => worker.close()));
  }

  register() {
    this.registerWorkers();
    this.registerQueueEventListeners();
  }

  registerWorkers() {
    const processors: InstanceWrapper[] = this.discoveryService
      .getProviders()
      .filter((wrapper: InstanceWrapper) =>
        this.metadataAccessor.isProcessor(
          !wrapper.metatype || wrapper.inject ? wrapper.instance?.constructor : wrapper.metatype,
        ),
      );

    processors.forEach((wrapper: InstanceWrapper) => {
      const { instance, metatype } = wrapper;
      const isRequestScoped = !wrapper.isDependencyTreeStatic();
      const { name: queueName, configKey } = this.metadataAccessor.getProcessorMetadata(
        instance.constructor || metatype,
      );

      const queueToken = getQueueToken(queueName);
      const queueOpts = this.getQueueOptions(queueToken, queueName, configKey);

      if (!(instance instanceof WorkerHost)) {
        throw new InvalidProcessorClassError(instance.constructor?.name);
      }
      const workerOptions = this.metadataAccessor.getWorkerOptionsMetadata(instance.constructor);
      this.handleProcessor(
        instance,
        queueName,
        queueOpts,
        wrapper.host,
        isRequestScoped,
        workerOptions,
      );

      this.registerWorkerEventListeners(wrapper);
    });
  }

  getQueueOptions(queueToken: string, queueName: string, configKey?: string) {
    try {
      const _queueRef = this.moduleRef.get<QueueHubQueue>(queueToken, { strict: false });
      return {} as NestQueueOptions;
    } catch (_err) {
      const sharedConfigToken = getSharedConfigToken(configKey);
      try {
        return this.moduleRef.get<NestQueueOptions>(sharedConfigToken, {
          strict: false,
        });
      } catch (err) {
        this.logger.error(NO_QUEUE_FOUND(queueName));
        throw err;
      }
    }
  }

  getFlowProducerOptions(flowProducerToken: string, name: string, configKey?: string) {
    try {
      const _flowProducerRef = this.moduleRef.get<QueueHubFlowProducer>(flowProducerToken, {
        strict: false,
      });
      return {};
    } catch (_err) {
      const sharedConfigToken = getSharedConfigToken(configKey);
      try {
        return this.moduleRef.get<any>(sharedConfigToken, {
          strict: false,
        });
      } catch (err) {
        this.logger.error(NO_FLOW_PRODUCER_FOUND(name));
        throw err;
      }
    }
  }

  handleProcessor<T extends WorkerHost>(
    instance: T,
    queueName: string,
    _queueOpts: NestQueueOptions,
    moduleRef: Module,
    isRequestScoped: boolean,
    options: NestWorkerOptions = {},
  ) {
    const methodKey = 'process';
    const { QueueFactoryRegistry } = require('./drivers/queue-factory-registry');
    const { QueueHubDriver } = require('./interfaces');

    const queueToken = getQueueToken(queueName);
    const queue = this.moduleRef.get<QueueHubQueue>(queueToken, { strict: false });

    let driver = QueueHubDriver.OCI_QUEUE;
    try {
      const sharedConfig = this.moduleRef.get<QueueHubRootModuleOptions>(
        QUEUE_HUB_CONFIG_DEFAULT_TOKEN,
        { strict: false },
      );
      driver = sharedConfig?.driver || QueueHubDriver.OCI_QUEUE;
    } catch {
      // Default config not found, use default driver
    }
    const factory = QueueFactoryRegistry.getFactory(driver);

    let processorFn: ProcessorFunction;

    if (isRequestScoped) {
      processorFn = async (jobRef: QueueHubJob) => {
        const contextId = ContextIdFactory.getByRequest(jobRef);

        if (this.moduleRef.registerRequestByContextId && !contextId[REQUEST_CONTEXT_ID]) {
          this.moduleRef.registerRequestByContextId(jobRef, contextId);
        }

        const contextInstance = await this.injector.loadPerContext(
          instance,
          moduleRef,
          moduleRef.providers,
          contextId,
        );
        const processor = contextInstance[methodKey].bind(contextInstance);
        return this.processorDecoratorService.decorate(processor)(jobRef);
      };
    } else {
      processorFn = instance[methodKey].bind(instance);
      processorFn = this.processorDecoratorService.decorate(processorFn);
    }

    const worker = factory.createWorker(queueName, queue, processorFn, {
      concurrency: options.concurrency || 1,
      pollingInterval: 1000,
    });

    setTimeout(() => {
      if (!worker.isRunning()) {
        this.logger.warn(
          `Worker for queue "${queueName}" is not running after creation, attempting to start...`,
        );
        worker.start().catch((error) => {
          this.logger.error(`Failed to start worker for queue "${queueName}":`, error);
          this.logger.error('Error details:', error?.stack);
        });
      } else {
        this.logger.log(`Worker for queue "${queueName}" is running`);
      }
    }, 500);

    (instance as any)._worker = worker;
    this.workers.push(worker);

    this.logger.log(`✅ Worker registered for queue "${queueName}"`);
  }

  registerWorkerEventListeners(wrapper: InstanceWrapper) {
    const { instance } = wrapper;

    this.metadataScanner.scanFromPrototype(
      instance,
      Object.getPrototypeOf(instance),
      (key: string) => {
        const workerEventHandlerMetadata = this.metadataAccessor.getOnWorkerEventMetadata(
          instance[key],
        );
        if (workerEventHandlerMetadata) {
          this.handleWorkerEvents(key, wrapper, workerEventHandlerMetadata);
        }
      },
    );
  }

  handleWorkerEvents(key: string, wrapper: InstanceWrapper, options: OnWorkerEventMetadata) {
    const { instance } = wrapper;

    if (!wrapper.isDependencyTreeStatic()) {
      this.logger.warn(
        `Warning! "${wrapper.name}" class is request-scoped and it defines an event listener ("${wrapper.name}#${key}"). Since event listeners cannot be registered on scoped providers, this handler will be ignored.`,
      );
      return;
    }
    instance.worker.on(options.eventName, instance[key].bind(instance));
  }

  registerQueueEventListeners() {
    const eventListeners: InstanceWrapper[] = this.discoveryService
      .getProviders()
      .filter((wrapper: InstanceWrapper) =>
        this.metadataAccessor.isQueueEventsListener(
          !wrapper.metatype || wrapper.inject ? wrapper.instance?.constructor : wrapper.metatype,
        ),
      );

    eventListeners.forEach((wrapper: InstanceWrapper) => {
      const { instance, metatype } = wrapper;
      if (!wrapper.isDependencyTreeStatic()) {
        this.logger.warn(
          `Warning! "${wrapper.name}" class is request-scoped and it is flagged as an event listener. Since event listeners cannot be registered on scoped providers, this handler will be ignored.`,
        );
        return;
      }

      const { queueName } = this.metadataAccessor.getQueueEventsListenerMetadata(
        instance.constructor || metatype,
      );

      if (!(instance instanceof QueueEventsHost)) {
        throw new InvalidQueueEventsListenerClassError(instance.constructor?.name);
      }
      const queueToken = getQueueToken(queueName);
      const _queueOpts = this.getQueueOptions(queueToken, queueName);
      const queue = this.moduleRef.get<QueueHubQueue>(queueToken, { strict: false });

      const { QueueFactoryRegistry } = require('./drivers/queue-factory-registry');
      const { QueueHubDriver } = require('./interfaces');
      let driver = QueueHubDriver.OCI_QUEUE;
      try {
        const sharedConfig = this.moduleRef.get<QueueHubRootModuleOptions>(
          QUEUE_HUB_CONFIG_DEFAULT_TOKEN,
          { strict: false },
        );
        driver = sharedConfig?.driver || QueueHubDriver.OCI_QUEUE;
      } catch {
        // Default config not found, use default driver
      }
      const factory = QueueFactoryRegistry.getFactory(driver);
      const queueEventsInstance = factory.createQueueEvents(queue);

      (instance as any)._queueEvents = queueEventsInstance;

      this.metadataScanner.scanFromPrototype(
        instance,
        Object.getPrototypeOf(instance),
        (key: string) => {
          const queueEventHandlerMetadata = this.metadataAccessor.getOnQueueEventMetadata(
            instance[key],
          );
          if (queueEventHandlerMetadata) {
            this.handleQueueEvents(key, wrapper, queueEventsInstance, queueEventHandlerMetadata);
          }
        },
      );
    });
  }

  handleQueueEvents(
    key: string,
    wrapper: InstanceWrapper,
    queueEventsInstance: QueueHubQueueEvents,
    options: OnQueueEventMetadata,
  ) {
    const { eventName } = options;
    const { instance } = wrapper;

    queueEventsInstance.on(eventName, instance[key].bind(instance));
  }
}
