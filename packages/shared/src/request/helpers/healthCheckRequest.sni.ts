/**
 * Health Check Request - Shared SNI implementation for Native/Desktop
 * Supports IP Table direct connection with SNI
 *
 * ✅ Reuses ipTableAdapter logic to follow DRY principle
 * ✅ Platform-agnostic: sniRequest adapts to Native/Desktop automatically
 */

import { OneKeyLocalError } from '../../errors';

import { getSelectedIpForHost } from './ipTableAdapter';
import { isProxyActiveForUrl, isSniSupported, sniRequest } from './sniRequest';

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

function isSniFailClosedError(error: unknown): boolean {
  const code =
    error && typeof error === 'object' && 'code' in error
      ? String((error as { code?: unknown }).code)
      : '';
  const message = error instanceof Error ? error.message : String(error);
  return (
    [
      'SNI_INVALID_CONFIG',
      'SNI_SECURITY_POLICY_FAILED',
      'SNI_TLS_FAILED',
      'SNI_CERT_FAILED',
      'SNI_RESPONSE_FAILED',
      'SNI_RESOURCE_LIMIT',
      'SNI_CANCELLED',
    ].includes(code) ||
    /SNI_(INVALID_CONFIG|SECURITY_POLICY_FAILED|TLS_FAILED|CERT_FAILED|RESPONSE_FAILED|RESOURCE_LIMIT|CANCELLED)/.test(
      message,
    ) ||
    /certificate|tls|ssl|unsafe header|forbidden ip|invalid config|response body too large/i.test(
      message,
    )
  );
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

  let proxyActive: boolean | null;
  try {
    proxyActive = await isProxyActiveForUrl(url);
  } catch {
    proxyActive = null;
  }
  if (proxyActive !== false) {
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
    if (isSniFailClosedError(error)) {
      throw error;
    }

    console.warn(
      '[HealthCheck] SNI request failed, falling back to fetch:',
      error,
    );
    return fallbackToFetch(config);
  }
}
