/**
 * Network Doctor Library - Configuration
 *
 * Default configuration and configuration merging logic
 */

import type { IDefaultConfig, IDoctorConfig, IMergedConfig } from './types';

/**
 * Default Configuration
 */
export const DEFAULT_CONFIG: IDefaultConfig = {
  timeouts: {
    dns: 10_000,
    tcp: 10_000,
    tls: 10_000,
    http: 10_000,
    ping: 5000,
  },
  extraPingTargets: ['1.1.1.1', '8.8.8.8', 'baidu.com', 'google.com'],
  extraHttpProbes: [
    { label: 'cloudflare_trace', url: 'https://1.1.1.1/cdn-cgi/trace' },
    {
      label: 'google_generate_204',
      url: 'https://www.google.com/generate_204',
    },
    { label: 'baidu_home', url: 'https://www.baidu.com' },
  ],
  enableNetworkLogger: true,
  maxNetworkLogs: 1000,
};

/**
 * Merge user configuration with default configuration
 */
export function mergeConfig(userConfig: IDoctorConfig): IMergedConfig {
  return {
    timeouts: {
      ...DEFAULT_CONFIG.timeouts,
      ...userConfig.timeouts,
    },
    extraPingTargets:
      userConfig.extraPingTargets ?? DEFAULT_CONFIG.extraPingTargets,
    extraHttpProbes:
      userConfig.extraHttpProbes ?? DEFAULT_CONFIG.extraHttpProbes,
    enableNetworkLogger:
      userConfig.enableNetworkLogger ?? DEFAULT_CONFIG.enableNetworkLogger,
    maxNetworkLogs: userConfig.maxNetworkLogs ?? DEFAULT_CONFIG.maxNetworkLogs,
    onProgress: userConfig.onProgress,
  };
}
