import {
  NATIVE_SLOW_4G_DOWNLOAD_BPS,
  NATIVE_SLOW_4G_LATENCY_MS,
  NATIVE_SLOW_4G_UPLOAD_BPS,
} from './types';

import type { INativeNetworkThrottleConfig } from './types';

const defaultNetworkThrottleConfig: INativeNetworkThrottleConfig = {
  enabled: false,
  profile: 'slow4g',
  latencyMs: NATIVE_SLOW_4G_LATENCY_MS,
  downloadBps: NATIVE_SLOW_4G_DOWNLOAD_BPS,
  uploadBps: NATIVE_SLOW_4G_UPLOAD_BPS,
};

let networkThrottleRuntimeConfig = defaultNetworkThrottleConfig;

export function normalizeNetworkThrottleConfig(
  config: Partial<INativeNetworkThrottleConfig> = {},
): INativeNetworkThrottleConfig {
  return {
    enabled: Boolean(config.enabled),
    profile: 'slow4g',
    latencyMs: config.latencyMs ?? NATIVE_SLOW_4G_LATENCY_MS,
    downloadBps: config.downloadBps ?? NATIVE_SLOW_4G_DOWNLOAD_BPS,
    uploadBps: config.uploadBps ?? NATIVE_SLOW_4G_UPLOAD_BPS,
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
