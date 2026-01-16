/**
 * Health Check Request - Shared SNI implementation for Native/Desktop
 * Supports IP Table direct connection with SNI
 *
 * ✅ Reuses ipTableAdapter logic to follow DRY principle
 * ✅ Platform-agnostic: sniRequest adapts to Native/Desktop automatically
 */

import { OneKeyLocalError } from '../../errors';

import { getSelectedIpForHost } from './ipTableAdapter';
import { isSniSupported, sniRequest } from './sniRequest';

import type {
  IHealthCheckConfig,
  IHealthCheckResponse,
} from './healthCheckRequest';

/**
 * Fallback to native fetch when SNI is not available
 */
async function fallbackToFetch(
  config: IHealthCheckConfig,
): Promise<IHealthCheckResponse> {
  const { url, method = 'GET', timeout = 10_000, headers = {} } = config;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch(url, {
      method,
      headers,
      signal: controller.signal,
    });

    return {
      status: response.status,
      ok: response.ok,
    };
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Extract hostname from full URL
 */
function extractHostname(url: string): string | null {
  try {
    const urlObj = new URL(url);
    return urlObj.hostname;
  } catch {
    return null;
  }
}

/**
 * Perform health check request with IP Table support
 * Falls back to native fetch if SNI is not supported or IP Table is disabled
 */
export async function healthCheckRequest(
  config: IHealthCheckConfig,
): Promise<IHealthCheckResponse> {
  const { url, method = 'GET', timeout = 10_000, headers = {} } = config;

  // Extract hostname from URL
  const hostname = extractHostname(url);
  if (!hostname) {
    throw new OneKeyLocalError(
      '[HealthCheck] Invalid URL - cannot extract hostname',
    );
  }

  // Check if SNI is supported on this platform
  const sniSupported = isSniSupported();
  if (!sniSupported) {
    return fallbackToFetch(config);
  }

  const selectedIp = await getSelectedIpForHost(hostname);

  // If no IP mapping found, use native fetch
  if (!selectedIp) {
    return fallbackToFetch(config);
  }

  // Use SNI direct IP connection
  console.log(
    `[HealthCheck] Using IP direct connection: ${hostname} -> ${selectedIp}`,
  );

  try {
    const urlObj = new URL(url);
    const path = urlObj.pathname + urlObj.search;

    const sniResponse = await sniRequest({
      ip: selectedIp,
      hostname,
      path,
      headers,
      method,
      body: null,
      timeout,
      port: 443,
    });

    if (!sniResponse) {
      console.warn(
        '[HealthCheck] SNI request returned null, falling back to fetch',
      );
      return await fallbackToFetch(config);
    }

    return {
      status: sniResponse.statusCode,
      ok: sniResponse.statusCode >= 200 && sniResponse.statusCode < 300,
    };
  } catch (error) {
    console.warn(
      '[HealthCheck] SNI request failed, falling back to fetch:',
      error,
    );
    return fallbackToFetch(config);
  }
}
