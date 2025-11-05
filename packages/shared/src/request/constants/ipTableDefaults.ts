import type { IIpTableConfig } from '../types/ipTable';

/**
 * Default IP Table configuration
 * Used as fallback when no configuration is set in SimpleDB
 *
 * This provides built-in IP mappings for critical domains to ensure
 * basic functionality even before dynamic configuration is loaded.
 */
export const DEFAULT_IP_TABLE_CONFIG: IIpTableConfig = {
  enabled: true,
  hosts: {
    'onekeytest.com': {
      primaryIps: ['216.19.4.106'],
      fallbackIps: [],
      enabled: true,
    },
  },
  currentSelections: {
    'onekeytest.com': '216.19.4.106',
  },
};
