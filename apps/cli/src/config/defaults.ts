import type { AppConfig } from './config-schema';

export const DEFAULT_CONFIG: AppConfig = {
  default_chain: 'ethereum',
  output_format: 'auto',
  cache_ttl: 1_800_000,
};
