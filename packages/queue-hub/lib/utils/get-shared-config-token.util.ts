export const QUEUE_HUB_CONFIG_DEFAULT_TOKEN = 'QUEUE_HUB_CONFIG(default)';

export function getSharedConfigToken(configKey?: string): string {
  return configKey ? `QUEUE_HUB_CONFIG(${configKey})` : QUEUE_HUB_CONFIG_DEFAULT_TOKEN;
}
