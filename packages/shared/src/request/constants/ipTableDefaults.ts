import type { IIpTableRemoteConfig } from '../types/ipTable';

/**
 * Builtin IP Table configuration in new CDN format
 * Used as fallback when no CDN configuration is available
 *
 * This provides built-in IP mappings for critical domains to ensure
 * basic functionality even before CDN config is loaded.
 */
export const DEFAULT_IP_TABLE_CONFIG: IIpTableRemoteConfig = {
  version: 1,
  ttl_sec: 86_400, // 24 hours
  generated_at: '2025-11-06T07:45:53.357Z',
  signature: '', // Builtin config doesn't need signature verification
  domains: {
    'onekeycn.com': {
      endpoints: [
        {
          ip: '216.19.4.106',
          provider: 'builtin',
          region: 'CN',
          weight: 100,
        },
      ],
    },
    'onekeytest.com': {
      endpoints: [
        {
          ip: '216.19.4.106',
          provider: 'builtin',
          region: 'CN',
          weight: 100,
        },
      ],
    },
  },
};
