import {
  IConditionalDepHolder,
  createConditionalDepHolder,
} from '@batatahub.com/nestjs-queue-hub-shared';
import { DynamicModule, Module, Provider, Type } from '@nestjs/common';
import { DiscoveryModule } from '@nestjs/core';
import { ProcessorDecoratorService } from './instrument/processor-decorator.service';
import { QueueHubFlowProducer, QueueHubQueue, QueueHubWorker } from './interfaces';
import {
  QueueHubLogLevel,
  QueueHubRootModuleOptions,
  RegisterFlowProducerAsyncOptions,
  RegisterFlowProducerOptions,
  RegisterFlowProducerOptionsFactory,
  SharedQueueHubAsyncConfiguration,
  SharedQueueHubConfigurationFactory,
} from './interfaces';
import { QueueHubDriver } from './interfaces';
import {
  RegisterQueueAsyncOptions,
  RegisterQueueOptions,
  RegisterQueueOptionsFactory,
} from './interfaces/register-queue-options.interface';
import { QueueHubMetadataAccessor } from './queue-hub-metadata.accessor';
import { QUEUE_HUB_EXTRA_OPTIONS_TOKEN } from './queue-hub.constants';
import { QueueHubExplorer } from './queue-hub.explorer';
import {
  createFlowProducerOptionProviders,
  createFlowProducerProviders,
  createQueueOptionProviders,
  createQueueProviders,
} from './queue-hub.providers';
import { QueueHubRegistrar } from './queue-hub.registrar';
import {
  QUEUE_HUB_CONFIG_DEFAULT_TOKEN,
  getFlowProducerOptionsToken,
  getQueueOptionsToken,
  getSharedConfigToken,
} from './utils';
import { setLogLevel } from './utils/logger';

/**
 * @publicApi
 */
@Module({})
export class QueueHubModule {
  private static coreModuleDefinition = {
    global: true,
    module: QueueHubModule,
    imports: [DiscoveryModule],
    providers: [
      QueueHubExplorer,
      QueueHubMetadataAccessor,
      QueueHubRegistrar,
      ProcessorDecoratorService,
    ],
    exports: [QueueHubRegistrar],
  };

  /**
   * Registers a globally available configuration for all queues.
   *
   * @param queueHubConfig shared queue hub configuration object
   */
  static forRoot(queueHubConfig: QueueHubRootModuleOptions): DynamicModule;
  /**
   * Registers a globally available configuration under a specified "configKey".
   *
   * @param configKey a key under which the configuration should be available
   * @param sharedQueueHubConfig shared queue hub configuration object
   */
  static forRoot(configKey: string, queueHubConfig: QueueHubRootModuleOptions): DynamicModule;
  /**
   * Registers a globally available configuration for all queues
   * or using a specified "configKey" (if passed).
   *
   * @param keyOrConfig a key under which the configuration should be available or a queue hub configuration object
   * @param queueHubConfig queue hub configuration object
   */
  static forRoot(
    keyOrConfig: string | QueueHubRootModuleOptions,
    queueHubConfig?: QueueHubRootModuleOptions,
  ): DynamicModule {
    const [configKey, sharedQueueHubConfig] =
      typeof keyOrConfig === 'string' ? [keyOrConfig, queueHubConfig] : [undefined, keyOrConfig];

    const { extraOptions, logLevel, ...config } = sharedQueueHubConfig;

    if (logLevel !== undefined) {
      setLogLevel(logLevel);
    }

    const sharedQueueHubConfigProvider: Provider = {
      provide: getSharedConfigToken(configKey),
      useValue: config,
    };

    const extraOptionsProvider: Provider = {
      provide: QUEUE_HUB_EXTRA_OPTIONS_TOKEN,
      useValue: { ...extraOptions },
    };

    return {
      global: true,
      module: QueueHubModule,
      providers: [sharedQueueHubConfigProvider, extraOptionsProvider],
      exports: [sharedQueueHubConfigProvider, extraOptionsProvider],
    };
  }

  /**
   * Registers a globally available configuration for all queues.
   *
   * @param asyncQueueHubConfig shared queue hub configuration async factory
   */
  static forRootAsync(asyncQueueHubConfig: SharedQueueHubAsyncConfiguration): DynamicModule;
  /**
   * Registers a globally available configuration under a specified "configKey".
   *
   * @param configKey a key under which the configuration should be available
   * @param asyncQueueHubConfig shared queue hub configuration async factory
   */
  static forRootAsync(
    configKey: string,
    asyncQueueHubConfig: SharedQueueHubAsyncConfiguration,
  ): DynamicModule;
  /**
   * Registers a globally available configuration for all queues
   * or using a specified "configKey" (if passed).
   *
   * @param keyOrAsyncConfig a key under which the configuration should be available or a queue hub configuration object
   * @param asyncQueueHubConfig shared queue hub configuration async factory
   */
  static forRootAsync(
    keyOrAsyncConfig: string | SharedQueueHubAsyncConfiguration,
    asyncQueueHubConfig?: SharedQueueHubAsyncConfiguration,
  ): DynamicModule {
    const [configKey, asyncSharedQueueHubConfig] =
      typeof keyOrAsyncConfig === 'string'
        ? [keyOrAsyncConfig, asyncQueueHubConfig]
        : [undefined, keyOrAsyncConfig];

    const imports = QueueHubModule.getUniqImports([asyncSharedQueueHubConfig]);
    const providers = QueueHubModule.createAsyncSharedConfigurationProviders(
      configKey,
      asyncSharedQueueHubConfig,
    );

    const sharedConfigToken = getSharedConfigToken(configKey);
    const logLevelInitProvider: Provider = {
      provide: 'QUEUE_HUB_LOG_LEVEL_INIT',
      useFactory: (config: QueueHubRootModuleOptions) => {
        if (config?.logLevel !== undefined) {
          setLogLevel(config.logLevel);
        }
        return true;
      },
      inject: [sharedConfigToken],
    };

    return {
      global: true,
      module: QueueHubModule,
      imports,
      providers: asyncSharedQueueHubConfig.extraProviders
        ? [...providers, logLevelInitProvider, ...asyncSharedQueueHubConfig.extraProviders]
        : [...providers, logLevelInitProvider],
      exports: providers,
    };
  }

  static registerQueue(...options: RegisterQueueOptions[]): DynamicModule {
    const optionsArr = [].concat(options);
    const queueProviders = createQueueProviders(optionsArr);
    const queueOptionProviders = createQueueOptionProviders(optionsArr);

    return {
      module: QueueHubModule,
      imports: [QueueHubModule.coreModuleDefinition],
      providers: [...queueOptionProviders, ...queueProviders],
      exports: queueProviders,
    };
  }

  static registerQueueAsync(...options: RegisterQueueAsyncOptions[]): DynamicModule {
    const optionsArr = [].concat(options);
    const queueProviders = createQueueProviders(optionsArr);

    const imports = QueueHubModule.getUniqImports(optionsArr);
    const asyncQueueOptionsProviders = options
      .map((queueOptions) => QueueHubModule.createAsyncProviders(queueOptions))
      .reduce((a, b) => a.concat(b), []);
    const extraProviders = options
      .map((queueOptions) => queueOptions.extraProviders)
      .filter((extraProviders) => extraProviders)
      .reduce((a, b) => a.concat(b), []);

    return {
      imports: imports.concat(QueueHubModule.coreModuleDefinition),
      module: QueueHubModule,
      providers: [...asyncQueueOptionsProviders, ...queueProviders, ...extraProviders],
      exports: queueProviders,
    };
  }

  private static createAsyncProviders(options: RegisterQueueAsyncOptions): Provider[] {
    const optionalSharedConfigHolder = createConditionalDepHolder(
      getSharedConfigToken(options.configKey),
      QUEUE_HUB_CONFIG_DEFAULT_TOKEN,
    );

    if (options.useExisting || options.useFactory) {
      return [
        optionalSharedConfigHolder,
        QueueHubModule.createAsyncOptionsProvider(options, optionalSharedConfigHolder),
      ];
    }
    if (!options.useClass) {
      throw new Error(
        'registerQueueAsync requires either useFactory, useExisting, or useClass to be provided',
      );
    }
    const useClass = options.useClass;
    return [
      optionalSharedConfigHolder,
      QueueHubModule.createAsyncOptionsProvider(options, optionalSharedConfigHolder),
      {
        provide: useClass,
        useClass,
      },
    ];
  }

  private static createAsyncOptionsProvider(
    asyncOptions: RegisterQueueAsyncOptions,
    optionalSharedConfigHolderRef: Type<IConditionalDepHolder<QueueHubRootModuleOptions>>,
  ): Provider {
    if (asyncOptions.useFactory) {
      return {
        provide: getQueueOptionsToken(asyncOptions.name),
        useFactory: async (
          optionalDepHolder: IConditionalDepHolder<QueueHubRootModuleOptions>,
          ...factoryArgs: unknown[]
        ) => {
          return {
            ...optionalDepHolder.getDependencyRef(asyncOptions.name),
            ...(await asyncOptions.useFactory(...factoryArgs)),
          };
        },
        inject: [optionalSharedConfigHolderRef, ...(asyncOptions.inject || [])],
      };
    }
    const inject = [asyncOptions.useClass || asyncOptions.useExisting];
    return {
      provide: getQueueOptionsToken(asyncOptions.name),
      useFactory: async (
        optionalDepHolder: IConditionalDepHolder<QueueHubRootModuleOptions>,
        optionsFactory: RegisterQueueOptionsFactory,
      ) => {
        return {
          ...optionalDepHolder.getDependencyRef(asyncOptions.name),
          ...(await optionsFactory.createRegisterQueueOptions()),
        };
      },
      inject: [optionalSharedConfigHolderRef, ...inject],
    };
  }

  static registerFlowProducer(...options: RegisterFlowProducerOptions[]): DynamicModule {
    const optionsArr = [].concat(options);
    const queues = new Map<string, QueueHubQueue>();
    const flowProducerProviders = createFlowProducerProviders(optionsArr, queues);
    const flowProducerOptionProviders = createFlowProducerOptionProviders(optionsArr);

    return {
      module: QueueHubModule,
      imports: [QueueHubModule.coreModuleDefinition],
      providers: [...flowProducerOptionProviders, ...flowProducerProviders],
      exports: flowProducerProviders,
    };
  }

  static registerFlowProducerAsync(...options: RegisterFlowProducerAsyncOptions[]): DynamicModule {
    const optionsArr = [].concat(options);
    const imports = QueueHubModule.getUniqImports(optionsArr);
    const asyncFlowProducerOptionsProviders = options
      .map((flowProducerOptions) =>
        QueueHubModule.createAsyncFlowProducerProviders(flowProducerOptions),
      )
      .reduce((a, b) => a.concat(b), []);

    return {
      imports: imports.concat(QueueHubModule.coreModuleDefinition),
      module: QueueHubModule,
      providers: [...asyncFlowProducerOptionsProviders],
      exports: [QueueHubModule.coreModuleDefinition],
    };
  }

  private static createAsyncFlowProducerProviders(
    options: RegisterFlowProducerAsyncOptions,
  ): Provider[] {
    const optionalSharedConfigHolder = createConditionalDepHolder(
      getSharedConfigToken(options.configKey),
      QUEUE_HUB_CONFIG_DEFAULT_TOKEN,
    );

    if (options.useExisting || options.useFactory) {
      return [
        optionalSharedConfigHolder,
        QueueHubModule.createAsyncFlowProducerOptionsProvider(options, optionalSharedConfigHolder),
      ];
    }
    if (!options.useClass) {
      return createFlowProducerOptionProviders([options]);
    }
    const useClass = options.useClass;
    return [
      optionalSharedConfigHolder,
      QueueHubModule.createAsyncFlowProducerOptionsProvider(options, optionalSharedConfigHolder),
      {
        provide: useClass,
        useClass,
      },
    ];
  }

  private static createAsyncFlowProducerOptionsProvider(
    asyncOptions: RegisterFlowProducerAsyncOptions,
    optionalSharedConfigHolderRef: Type<IConditionalDepHolder<QueueHubRootModuleOptions>>,
  ): Provider {
    if (asyncOptions.useFactory) {
      return {
        provide: getFlowProducerOptionsToken(asyncOptions.name),
        useFactory: async (
          optionalDepHolder: IConditionalDepHolder<QueueHubRootModuleOptions>,
          ...factoryArgs: unknown[]
        ) => {
          return {
            ...optionalDepHolder.getDependencyRef(asyncOptions.name),
            ...(await asyncOptions.useFactory(...factoryArgs)),
          };
        },
        inject: [optionalSharedConfigHolderRef, ...(asyncOptions.inject || [])],
      };
    }
    const inject = [asyncOptions.useClass || asyncOptions.useExisting];
    return {
      provide: getFlowProducerOptionsToken(asyncOptions.name),
      useFactory: async (
        optionalDepHolder: IConditionalDepHolder<QueueHubRootModuleOptions>,
        optionsFactory: RegisterFlowProducerOptionsFactory,
      ) => {
        return {
          ...optionalDepHolder.getDependencyRef(asyncOptions.name),
          ...(await optionsFactory.createRegisterQueueOptions()),
        };
      },
      inject: [optionalSharedConfigHolderRef, ...inject],
    };
  }

  private static createAsyncSharedConfigurationProviders(
    configKey: string | undefined,
    options: SharedQueueHubAsyncConfiguration,
  ): Provider[] {
    const { extraOptions, ...config } = options;

    const extraOptionsProvider: Provider = {
      provide: QUEUE_HUB_EXTRA_OPTIONS_TOKEN,
      useValue: { ...extraOptions },
    };

    if (options.useExisting || options.useFactory) {
      return [
        QueueHubModule.createAsyncSharedConfigurationProvider(configKey, config),
        extraOptionsProvider,
      ];
    }
    const useClass = config.useClass;
    return [
      QueueHubModule.createAsyncSharedConfigurationProvider(configKey, config),
      extraOptionsProvider,
      {
        provide: useClass,
        useClass,
      },
    ];
  }

  private static createAsyncSharedConfigurationProvider(
    configKey: string | undefined,
    options: SharedQueueHubAsyncConfiguration,
  ): Provider {
    if (options.useFactory) {
      return {
        provide: getSharedConfigToken(configKey),
        useFactory: options.useFactory,
        inject: options.inject || [],
      };
    }
    const inject = [options.useClass || options.useExisting];
    return {
      provide: getSharedConfigToken(configKey),
      useFactory: async (optionsFactory: SharedQueueHubConfigurationFactory) =>
        optionsFactory.createSharedConfiguration(),
      inject,
    };
  }

  private static getUniqImports(
    options: Array<RegisterQueueAsyncOptions | SharedQueueHubAsyncConfiguration>,
  ) {
    return (
      options
        .map((option) => option.imports)
        .reduce((acc, i) => acc.concat(i || []), [])
        .filter((v, i, a) => a.indexOf(v) === i) || []
    );
  }
}
