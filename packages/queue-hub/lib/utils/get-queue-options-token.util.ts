export function getQueueOptionsToken(name?: string): string {
  return name ? `QueueHubMQQueueOptions_${name}` : 'QueueHubMQQueueOptions_default';
}
