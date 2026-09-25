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
 * Domain Failover Threshold
 * After this many consecutive real-request network failures on the direct
 * domain, immediately switch selection to the last known-good IP (service)
 * or fail-open to a builtin IP (adapter) without waiting for a speed test.
 */
export const IP_TABLE_DOMAIN_FAILOVER_THRESHOLD = 3;

/**
 * Adapter fail-open window. While active, hosts of the affected root domain
 * resolve to a fallback IP even when no runtime selection exists (covers the
 * main runtime and the cold-start window where simpleDb config is absent).
 */
export const IP_TABLE_ADAPTER_FAILOVER_TTL_MS = timerUtils.getTimeDurationMs({
  minute: 5,
});

/**
 * SNI Bypass Threshold
 * After this many consecutive real-request failures on the selected IP, the
 * adapter stops handing requests to the SNI transport for a short window and
 * sends them over the domain, exactly as if no IP were selected. The service
 * needs IP_TABLE_SNI_FAILURE_THRESHOLD failures plus a probing round before it
 * can change the selection; this keeps a dead IP from costing every request a
 * wasted attempt (or a non-idempotent request its only attempt) until then.
 */
export const IP_TABLE_SNI_BYPASS_THRESHOLD = 3;

export const IP_TABLE_SNI_BYPASS_TTL_MS = timerUtils.getTimeDurationMs({
  minute: 1,
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
        {
          'ip': '43.168.19.96',
          'provider': 'EdgeOne',
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
          'ip': '43.168.24.171',
          'provider': 'EdgeOne',
          'region': 'CN',
          'weight': 100,
        },
        {
          'ip': '43.168.19.96',
          'provider': 'EdgeOne',
          'region': 'CN',
          'weight': 100,
        },
      ],
    },
  },
  'generated_at': '2026-09-18T06:39:56.839Z',
  'signature':
    '0xda46448865c48a3fd8ec9f9ae131c9ed22a433ed480232cf149883c621a9f53015acc0eb94cdf4c55542e88290c950a60602eff07e35b0f1e7cd4d06710f6ee51c',
  'ttl_sec': 86_400,
  'version': 1,
};
