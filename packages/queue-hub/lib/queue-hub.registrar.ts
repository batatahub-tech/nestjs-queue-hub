import { Injectable, OnModuleInit } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import { QueueHubModuleExtraOptions } from './interfaces';
import { QUEUE_HUB_EXTRA_OPTIONS_TOKEN } from './queue-hub.constants';
import { QueueHubExplorer } from './queue-hub.explorer';

@Injectable()
export class QueueHubRegistrar implements OnModuleInit {
  constructor(
    private readonly moduleRef: ModuleRef,
    private readonly queueHubExplorer: QueueHubExplorer,
  ) {}

  onModuleInit() {
    const extraOptions = this.getModuleExtras();

    if (extraOptions?.manualRegistration) {
      return;
    }

    this.register();
  }

  register() {
    return this.queueHubExplorer.register();
  }

  private getModuleExtras(): QueueHubModuleExtraOptions | null {
    try {
      const extrasToken = QUEUE_HUB_EXTRA_OPTIONS_TOKEN;
      return this.moduleRef.get<QueueHubModuleExtraOptions>(extrasToken, {
        strict: false,
      });
    } catch {
      return null;
    }
  }
}
