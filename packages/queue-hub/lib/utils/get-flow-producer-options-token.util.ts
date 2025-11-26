export function getFlowProducerOptionsToken(name?: string): string {
  return name ? `QueueHubMQFlowProducerOptions_${name}` : 'QueueHubMQFlowProducerOptions_default';
}
