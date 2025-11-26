import { Type } from '@nestjs/common';
import { MissingQueueHubSharedConfigurationError } from '../errors/missing-shared-queue-hub-config.error';
export interface IConditionalDepHolder<T = any> {
  getDependencyRef(caller: string): T;
}
export declare function createConditionalDepHolder<_T = any>(
  depToken: string,
  optionalDep: string,
  errorFactory?: (caller: string) => MissingQueueHubSharedConfigurationError,
): Type<IConditionalDepHolder>;
