import { URL } from 'url';
import {
  QueueHubQueueAdvancedProcessor,
  QueueHubQueueAdvancedSeparateProcessor,
} from '../interfaces/queue-hub-processor.interfaces';
import {
  QueueHubQueueProcessor,
  QueueHubQueueProcessorCallback,
  QueueHubQueueSeparateProcessor,
} from '../queue-hub.types';

export function isProcessorCallback(
  processor: QueueHubQueueProcessor,
): processor is QueueHubQueueProcessorCallback {
  return 'function' === typeof processor;
}

export function isAdvancedProcessor(
  processor: QueueHubQueueProcessor,
): processor is QueueHubQueueAdvancedProcessor {
  return (
    'object' === typeof processor &&
    !!(processor as QueueHubQueueAdvancedProcessor).callback &&
    isProcessorCallback((processor as QueueHubQueueAdvancedProcessor).callback)
  );
}

export function isSeparateProcessor(
  processor: QueueHubQueueProcessor,
): processor is QueueHubQueueSeparateProcessor {
  return 'string' === typeof processor || processor instanceof URL;
}

export function isAdvancedSeparateProcessor(
  processor: QueueHubQueueProcessor,
): processor is QueueHubQueueAdvancedSeparateProcessor {
  return (
    'object' === typeof processor &&
    !!(processor as QueueHubQueueAdvancedSeparateProcessor).path &&
    isSeparateProcessor((processor as QueueHubQueueAdvancedSeparateProcessor).path)
  );
}
