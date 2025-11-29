import { FactoryProvider, ModuleMetadata, Provider, Type } from '@nestjs/common';
import * as common from 'oci-common';
import { AdvancedSettings } from './queue-hub-advanced-settings.interface';
import { JobOpts } from './queue-hub-job-opts.interface';

/**
 * @publicApi
 */
export interface QueueHubModuleExtraOptions {
  /**
   * If set to true, the module will not register the queues automatically.
   * This is useful when you want to manually register the queues.
   */
  manualRegistration?: boolean;
}

/**
 * OCI Queue Configuration
 * Used in root module for authentication settings
 * @publicApi
 */
export interface OciQueueConnectionConfig {
  /**
   * OCI Config profile name (defaults to 'DEFAULT')
   * If not provided, will use ConfigFileAuthenticationDetailsProvider with default values
   * Ignored if token authentication is used
   */
  profile?: string;
  /**
   * Optional: Custom authentication provider
   * If not provided, will create ConfigFileAuthenticationDetailsProvider automatically
   * or SimpleAuthenticationDetailsProvider if token credentials are provided
   */
  provider?: common.AuthenticationDetailsProvider;
  /**
   * Token-based authentication credentials
   * If provided, will use SimpleAuthenticationDetailsProvider instead of config file
   */
  tokenAuth?: {
    tenancyId: string;
    userId: string;
    fingerprint: string;
    privateKey: string;
    passphrase?: string;
  };
  /**
   * Compartment OCID (optional)
   * If not provided, will try to get from environment variable OCI_COMPARTMENT_ID
   * or from the tenancy OCID if available
   */
  compartmentId?: string;
  /**
   * Region (optional)
   * Can be overridden per queue
   */
  region?: string;
}

/**
 * Available queue drivers
 * @publicApi
 */
export enum QueueHubDriver {
  OCI_QUEUE = 'oci-queue',
  LOCAL = 'local',
}

/**
 * Log levels for queue-hub
 * @publicApi
 */
export enum QueueHubLogLevel {
  ERROR = 0,
  WARN = 1,
  INFO = 2,
  DEBUG = 3,
}

/**
 * Connection options for queue configuration
 * This is a generic type that can be extended by specific drivers
 * @publicApi
 */
export type ConnectionOptions = OciQueueConnectionConfig;

/**
 * @publicApi
 */
export interface QueueHubRootModuleOptions {
  /**
   * Queue driver to use
   * @default QueueHubDriver.OCI_QUEUE
   */
  driver?: QueueHubDriver;
  /**
   * Enable local mode (in-memory queue) for development/testing.
   * When enabled, queues run in-memory without connecting to external services.
   * @default false
   */
  localMode?: boolean;
  /**
   * Options to configure the connection.
   * See Connections for more information.
   */
  connection?: ConnectionOptions;
  /**
   * Prefix for all queue keys.
   */
  prefix?: string;
  /**
   * Options to control the default settings for new jobs.
   * See JobOpts for more information.
   */
  defaultJobOptions?: JobOpts;
  /**
   * Advanced Queue configuration settings.
   * These should usually not be changed.
   * See AdvancedSettings for more information.
   */
  settings?: AdvancedSettings;
  /**
   * Extra options for module init.
   * See Manual Registration
   */
  extraOptions?: QueueHubModuleExtraOptions;
  /**
   * Log level for queue-hub operations
   * Defaults to INFO (only errors, warnings, and info messages)
   * Set to DEBUG for verbose logging
   */
  logLevel?: QueueHubLogLevel;
}

/**
 * @publicApi
 */
export interface SharedQueueHubConfigurationFactory {
  createSharedConfiguration(): Promise<QueueHubRootModuleOptions> | QueueHubRootModuleOptions;
}

/**
 * @publicApi
 */
export interface SharedQueueHubAsyncConfiguration extends Pick<ModuleMetadata, 'imports'> {
  /**
   * Existing Provider to be used.
   */
  useExisting?: Type<SharedQueueHubConfigurationFactory>;

  /**
   * Type (class name) of provider (instance to be registered and injected).
   */
  useClass?: Type<SharedQueueHubConfigurationFactory>;

  /**
   * Factory function that returns an instance of the provider to be injected.
   */
  useFactory?: (...args: any[]) => Promise<QueueHubRootModuleOptions> | QueueHubRootModuleOptions;

  /**
   * Optional list of providers to be injected into the context of the Factory function.
   */
  inject?: FactoryProvider['inject'];

  /**
   * Extra options for the QueueHub module.
   */
  extraOptions?: QueueHubModuleExtraOptions;

  /**
   * Extra providers to be registered in the module context.
   */
  extraProviders?: Provider[];
}
