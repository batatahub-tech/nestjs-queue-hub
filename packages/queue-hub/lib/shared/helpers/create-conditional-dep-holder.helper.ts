import { Inject, Optional, Type, mixin } from '@nestjs/common';
import { MissingQueueHubSharedConfigurationError } from '../errors/missing-shared-queue-hub-config.error';

export interface IConditionalDepHolder<T = any> {
  getDependencyRef(caller: string): T;
}

export function createConditionalDepHolder<T = any>(
  depToken: string,
  optionalDep: string,
  errorFactory = (caller: string) => new MissingQueueHubSharedConfigurationError(depToken, caller),
): Type<IConditionalDepHolder> {
  class ConditionalDepHolder {
    constructor(@Optional() @Inject(depToken) public _dependencyRef: T) {}

    getDependencyRef(caller: string): T {
      if (depToken !== optionalDep && !this._dependencyRef) {
        throw errorFactory(caller);
      }
      return this._dependencyRef;
    }
  }
  return mixin(ConditionalDepHolder);
}

