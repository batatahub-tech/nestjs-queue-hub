import {
  IConditionalDepHolder,
  createConditionalDepHolder,
  getQueueToken,
} from '@batatahub.com/nestjs-queue-hub-shared';
import { OnApplicationShutdown, Provider, flatten } from '@nestjs/common';
import * as common from 'oci-common';
import { QueueFactoryRegistry } from './drivers/queue-factory-registry';
import { RegisterFlowProducerOptions } from './interfaces';
import {
  QueueHubDriver,
  QueueHubFlowProducer,
  QueueHubQueue,
  QueueHubRootModuleOptions,
} from './interfaces';
import { RegisterQueueOptions } from './interfaces/register-queue-options.interface';
import { OciQueueConnectionConfig } from './interfaces/shared-queue-hub-config.interface';
import { QueueHubQueueProcessor } from './queue-hub.types';
import {
  QUEUE_HUB_CONFIG_DEFAULT_TOKEN,
  getFlowProducerOptionsToken,
  getFlowProducerToken,
  getQueueOptionsToken,
  getSharedConfigToken,
} from './utils';

/**
 * Custom authentication provider that fixes keyId format when session token exists
 * ConfigFileAuthenticationDetailsProvider returns tenancyOcid//fingerprint when session token exists
 * but it should return ST$sessionToken. This wrapper fixes that issue.
 *
 * The SDK should automatically detect session token and use it for authentication
 * when getKeyId() returns ST$sessionToken format and getSecurityToken() returns the token.
 */
class FixedSessionTokenProvider extends common.ConfigFileAuthenticationDetailsProvider {
  async getKeyId(): Promise<string> {
    if (this.sessionToken) {
      return `ST$${this.sessionToken}`;
    }
    return super.getKeyId();
  }

  async getSecurityToken(): Promise<string> {
    if (this.sessionToken) {
      return this.sessionToken;
    }
    return '';
  }

  getAuthType(): string | undefined {
    if (this.sessionToken) {
      return 'session_token';
    }
    return undefined;
  }
}

/**
 * Creates an OCI authentication provider from connection config
 * Uses FixedSessionTokenProvider to fix keyId format when session token exists
 */
function createAuthenticationProvider(
  config: OciQueueConnectionConfig,
): common.ConfigFileAuthenticationDetailsProvider {
  if (config.provider) {
    return config.provider;
  }

  const configFile = process.env.OCI_CONFIG_FILE || undefined;
  const profileName = config.profile || process.env.OCI_CONFIG_PROFILE || 'DEFAULT';
  const authenticationDetailsProvider = new FixedSessionTokenProvider(configFile, profileName);

  return authenticationDetailsProvider;
}

function createQueueAndWorkers(
  options: RegisterQueueOptions,
  driver: QueueHubDriver = QueueHubDriver.OCI_QUEUE,
): QueueHubQueue {
  const queueName = options.name ?? 'default';
  const factory = QueueFactoryRegistry.getFactory(driver);

  if (!options.connection) {
    throw new Error(`Connection configuration is required for driver "${driver}"`);
  }

  if (driver === QueueHubDriver.OCI_QUEUE) {
    const provider = createAuthenticationProvider(options.connection);
    const compartmentId =
      options.connection.compartmentId || process.env.OCI_COMPARTMENT_ID || provider.getTenantId();

    const queueConfig = {
      ...options.connection,
      provider,
      compartmentId,
    };

    const queue = factory.createQueue(queueName, queueConfig);

    if (options.processors) {
      options.processors.forEach((processor: QueueHubQueueProcessor) => {
        factory.createWorker(queueName, queue, processor, {
          concurrency: 1,
          pollingInterval: 1000,
        });
      });
    }

    (queue as unknown as OnApplicationShutdown).onApplicationShutdown = async function (
      this: QueueHubQueue,
    ) {
      await this.close();
    };

    return queue;
  }

  throw new Error(`Driver "${driver}" is not yet implemented`);
}

function createFlowProducers(
  _options: RegisterFlowProducerOptions,
  queues: Map<string, QueueHubQueue>,
  driver: QueueHubDriver = QueueHubDriver.OCI_QUEUE,
): QueueHubFlowProducer {
  const factory = QueueFactoryRegistry.getFactory(driver);
  const flowProducer = factory.createFlowProducer(queues);

  (flowProducer as unknown as OnApplicationShutdown).onApplicationShutdown = async function (
    this: QueueHubFlowProducer,
  ) {
    await this.close();
  };

  return flowProducer;
}

export function createQueueOptionProviders(options: RegisterQueueOptions[]): Provider[] {
  const providers = options.map((option) => {
    const optionalSharedConfigHolder = createConditionalDepHolder(
      getSharedConfigToken(option.configKey),
      QUEUE_HUB_CONFIG_DEFAULT_TOKEN,
    );
    return [
      optionalSharedConfigHolder,
      {
        provide: getQueueOptionsToken(option.name),
        useFactory: (optionalDepHolder: IConditionalDepHolder<any>) => {
          return {
            ...optionalDepHolder.getDependencyRef(option.name),
            ...option,
          };
        },
        inject: [optionalSharedConfigHolder],
      },
    ];
  });
  return flatten(providers);
}

export function createFlowProducerOptionProviders(
  options: RegisterFlowProducerOptions[],
): Provider[] {
  const providers = options.map((option) => {
    const optionalSharedConfigHolder = createConditionalDepHolder(
      getSharedConfigToken(option.configKey),
      QUEUE_HUB_CONFIG_DEFAULT_TOKEN,
    );
    return [
      optionalSharedConfigHolder,
      {
        provide: getFlowProducerOptionsToken(option.name),
        useFactory: (optionalDepHolder: IConditionalDepHolder<any>) => {
          return {
            ...optionalDepHolder.getDependencyRef(option.name),
            ...option,
          };
        },
        inject: [optionalSharedConfigHolder],
      },
    ];
  });
  return flatten(providers);
}

export function createQueueProviders(options: RegisterQueueOptions[]): Provider[] {
  const providers = options.map((item) => {
    const optionalSharedConfigHolder = createConditionalDepHolder(
      getSharedConfigToken(item.configKey),
      QUEUE_HUB_CONFIG_DEFAULT_TOKEN,
    );
    return [
      optionalSharedConfigHolder,
      {
        provide: getQueueToken(item.name),
        useFactory: (
          queueOptions: RegisterQueueOptions,
          optionalDepHolder: IConditionalDepHolder<QueueHubRootModuleOptions>,
        ) => {
          const queueName = queueOptions.name || item.name;
          const sharedConfig = optionalDepHolder?.getDependencyRef(queueName);
          const driver = sharedConfig?.driver || QueueHubDriver.OCI_QUEUE;
          return createQueueAndWorkers(
            {
              ...queueOptions,
              name: queueName,
            },
            driver,
          );
        },
        inject: [getQueueOptionsToken(item.name), optionalSharedConfigHolder],
      },
    ];
  });
  return flatten(providers);
}

export function createFlowProducerProviders(
  options: RegisterFlowProducerOptions[],
  queues: Map<string, QueueHubQueue>,
): Provider[] {
  const providers = options.map((item) => {
    const optionalSharedConfigHolder = createConditionalDepHolder(
      getSharedConfigToken(item.configKey),
      QUEUE_HUB_CONFIG_DEFAULT_TOKEN,
    );
    return [
      optionalSharedConfigHolder,
      {
        provide: getFlowProducerToken(item.name),
        useFactory: (
          flowProducerOptions: RegisterFlowProducerOptions,
          optionalDepHolder: IConditionalDepHolder<QueueHubRootModuleOptions>,
        ) => {
          const flowProducerName = flowProducerOptions.name || item.name;
          const driver =
            optionalDepHolder?.getDependencyRef(flowProducerName)?.driver ||
            QueueHubDriver.OCI_QUEUE;
          return createFlowProducers(
            { ...flowProducerOptions, name: flowProducerName },
            queues,
            driver,
          );
        },
        inject: [getFlowProducerOptionsToken(item.name), optionalSharedConfigHolder],
      },
    ];
  });
  return flatten(providers);
}
