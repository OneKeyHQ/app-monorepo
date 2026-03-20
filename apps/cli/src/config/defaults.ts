import type { IAppConfig } from './config-schema';

export const DEFAULT_CONFIG: IAppConfig = {
  default_chain: 'ethereum',
  output_format: 'auto',
  cache_ttl: 1_800_000,
};
