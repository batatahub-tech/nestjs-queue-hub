export function getQueueToken(name?: string): string {
  return name ? `QueueHubQueue_${name}` : 'QueueHubQueue_default';
}
