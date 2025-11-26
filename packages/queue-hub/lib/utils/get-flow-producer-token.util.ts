export function getFlowProducerToken(name?: string): string {
  return name ? `QueueHubFlowProducer_${name}` : 'QueueHubFlowProducer_default';
}
