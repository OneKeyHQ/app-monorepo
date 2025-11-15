/**
 * Network Doctor Library - Configuration
 *
 * Default configuration and configuration merging logic
 */

import type { IDefaultConfig, IDoctorConfig } from './types';

/**
 * Default Configuration
 */
export const DEFAULT_CONFIG: IDefaultConfig = {
  healthCheckPath: '/health',
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
export function mergeConfig(
  userConfig: IDoctorConfig,
): Required<IDoctorConfig> {
  return {
    targetDomain: userConfig.targetDomain,
    healthCheckPath:
      userConfig.healthCheckPath ?? DEFAULT_CONFIG.healthCheckPath,
    headersGenerator: userConfig.headersGenerator ?? (async () => ({})),
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
  };
}

/**
 * Build health check URL
 */
export function buildHealthCheckUrl(domain: string, path: string): string {
  // Ensure domain has no protocol prefix
  const cleanDomain = domain.replace(/^https?:\/\//, '');
  // Ensure path starts with /
  const cleanPath = path.startsWith('/') ? path : `/${path}`;

  return `https://${cleanDomain}${cleanPath}`;
}
