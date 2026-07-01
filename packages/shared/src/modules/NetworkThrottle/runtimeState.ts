import { NATIVE_SLOW_4G_LATENCY_MS } from './types';

import type { INativeNetworkThrottleConfig } from './types';

const defaultNetworkThrottleConfig: INativeNetworkThrottleConfig = {
  enabled: false,
  profile: 'slow4g',
  latencyMs: NATIVE_SLOW_4G_LATENCY_MS,
};

let networkThrottleRuntimeConfig = defaultNetworkThrottleConfig;

export function normalizeNetworkThrottleConfig(
  config: Partial<INativeNetworkThrottleConfig> = {},
): INativeNetworkThrottleConfig {
  return {
    enabled: Boolean(config.enabled),
    profile: 'slow4g',
    latencyMs: config.latencyMs ?? NATIVE_SLOW_4G_LATENCY_MS,
  };
}

export function setNetworkThrottleRuntimeConfig(
  config: Partial<INativeNetworkThrottleConfig>,
): INativeNetworkThrottleConfig {
  networkThrottleRuntimeConfig = normalizeNetworkThrottleConfig(config);
  return networkThrottleRuntimeConfig;
}

export function getNetworkThrottleRuntimeConfig(): INativeNetworkThrottleConfig {
  return networkThrottleRuntimeConfig;
}
