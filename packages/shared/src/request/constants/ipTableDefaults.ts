import timerUtils from '../../utils/timerUtils';

import type { IIpTableRemoteConfig } from '../types/ipTable';

// ========== IP Table Service Configuration Constants ==========

export const CDN_SIGNER_ADDRESS = '0x3eaf57d1aD767CA3aFeDbF8D82C1De610c6F6519';

/**
 * SNI Failure Threshold
 * Trigger speed test after this many consecutive SNI request failures
 */
export const IP_TABLE_SNI_FAILURE_THRESHOLD = 10;

export const IP_TABLE_SPEED_TEST_COOLDOWN_MS = timerUtils.getTimeDurationMs({
  minute: 2,
});

/**
 * Performance Improvement Threshold
 * Only use IP routing if it's at least this percentage faster than direct domain access
 * @default 0.3 (30% improvement required)
 * @example If domain latency is 100ms, IP must be ≤70ms to be selected
 */
export const IP_TABLE_PERFORMANCE_IMPROVEMENT_THRESHOLD = 0.3;

/**
 * Speed Test Iterations
 * Number of test runs per endpoint to calculate average latency
 * @default 3 iterations
 */
export const IP_TABLE_SPEED_TEST_ITERATIONS = 3;

/**
 * Speed Test Delay
 * Delay between consecutive test iterations in milliseconds
 * Prevents overwhelming the network with rapid consecutive requests
 * @default 200ms
 */
export const IP_TABLE_SPEED_TEST_DELAY_MS = 200;

/**
 * Speed Test Timeout
 * Maximum time to wait for a single speed test request in milliseconds
 * @default 3000ms (3 seconds)
 */
export const IP_TABLE_SPEED_TEST_TIMEOUT_MS = timerUtils.getTimeDurationMs({
  seconds: 3,
});

/**
 * Initial Speed Test Delay
 * Delay before running initial speed test on app startup in milliseconds
 * Allows app to complete critical initialization first
 * @default 10000ms (10 seconds)
 */
export const IP_TABLE_INITIAL_SPEED_TEST_DELAY_MS =
  timerUtils.getTimeDurationMs({
    seconds: 10,
  });

// ========== IP Table CDN Configuration ==========

/**
 * Builtin IP Table configuration in new CDN format
 * Used as fallback when no CDN configuration is available
 *
 * This provides built-in IP mappings for critical domains to ensure
 * basic functionality even before CDN config is loaded.
 */
export const DEFAULT_IP_TABLE_CONFIG: IIpTableRemoteConfig = {
  'domains': {
    'onekeycn.com': {
      'endpoints': [
        {
          'ip': '104.18.20.233',
          'provider': 'cloudflare',
          'region': 'GLOBAL',
          'weight': 100,
        },
        {
          'ip': '104.18.21.233',
          'provider': 'cloudflare',
          'region': 'GLOBAL',
          'weight': 100,
        },
        {
          'ip': '216.19.3.115',
          'provider': 'volcengine',
          'region': 'CN',
          'weight': 100,
        },
        {
          'ip': '216.19.2.116',
          'provider': 'volcengine',
          'region': 'CN',
          'weight': 100,
        },
        {
          'ip': '216.19.4.106',
          'provider': 'volcengine',
          'region': 'CN',
          'weight': 100,
        },
      ],
    },
    'onekeytest.com': {
      'endpoints': [
        {
          'ip': '104.18.31.39',
          'provider': 'cloudflare',
          'region': 'GLOBAL',
          'weight': 100,
        },
        {
          'ip': '104.18.30.39',
          'provider': 'cloudflare',
          'region': 'GLOBAL',
          'weight': 100,
        },
        {
          'ip': '216.19.3.115',
          'provider': 'volcengine',
          'region': 'CN',
          'weight': 100,
        },
        {
          'ip': '216.19.2.116',
          'provider': 'volcengine',
          'region': 'CN',
          'weight': 100,
        },
        {
          'ip': '216.19.4.106',
          'provider': 'volcengine',
          'region': 'CN',
          'weight': 100,
        },
      ],
    },
  },
  'generated_at': '2025-11-06T08:30:54.066Z',
  'signature':
    '0x68ba1ea09f8775576df53c7d3182b9837e0e752df41d147cc716713aa4b6ded054d26904655d01a0f02c504ac2861ec3eeee3e075ee5f00a4c299bc165ec43331c',
  'ttl_sec': 86_400,
  'version': 1,
};
