/**
 * Health Check Request - Shared SNI implementation for Native/Desktop
 * Supports IP Table direct connection with SNI
 *
 * ✅ Reuses ipTableAdapter logic to follow DRY principle
 * ✅ Platform-agnostic: sniRequest adapts to Native/Desktop automatically
 */

import { OneKeyLocalError } from '../../errors';
import { defaultLogger } from '../../logger/logger';

import { getSelectedIpForHost } from './ipTableAdapter';
import { isSniFailClosedError } from './sniFailClosedError';
import { safeSniLogValue } from './sniLogRedaction';
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

function hashForLog(value: string | null | undefined): string {
  if (!value) return 'none';
  let hash = 0x81_1c_9d_c5;
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 0x01_00_01_93) >>> 0;
  }
  return hash.toString(16).padStart(8, '0');
}

function getErrorCode(error: unknown): string {
  if (error && typeof error === 'object' && 'code' in error) {
    const code = (error as { code?: unknown }).code;
    if (typeof code === 'string') return code;
  }
  return 'none';
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function logHealthCheckSniDecision(
  level: 'info' | 'warn' | 'error',
  fields: Record<string, unknown>,
): void {
  const info = `[HealthCheck] ${Object.entries({
    event: 'healthcheck_sni_decision',
    ...fields,
  })
    .map(([key, value]) => `${key}=${safeSniLogValue(value)}`)
    .join(' ')}`;

  if (level === 'error') {
    defaultLogger.ipTable.request.error({ info });
  } else if (level === 'warn') {
    defaultLogger.ipTable.request.warn({ info });
  } else {
    defaultLogger.ipTable.request.info({ info });
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
  const startedAt = Date.now();

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
    logHealthCheckSniDecision('info', {
      hostname,
      method,
      sniSupported,
      proxyActive: 'skipped',
      hasSelectedIp: false,
      decision: 'fetch',
      reason: 'sni_unsupported',
      durationMs: Date.now() - startedAt,
    });
    return fallbackToFetch(config);
  }

  let proxyActive: boolean | null;
  let preflightError: unknown;
  try {
    proxyActive = await isProxyActiveForUrl(url);
  } catch (error) {
    preflightError = error;
    proxyActive = null;
  }
  if (proxyActive === true || preflightError) {
    logHealthCheckSniDecision('warn', {
      hostname,
      method,
      sniSupported,
      proxyActive: proxyActive === null ? 'null' : proxyActive,
      hasSelectedIp: false,
      decision: 'fetch',
      reason: proxyActive === true ? 'proxy_active' : 'preflight_error',
      errorCode: preflightError ? getErrorCode(preflightError) : 'none',
      errorMessage: preflightError ? getErrorMessage(preflightError) : 'none',
      durationMs: Date.now() - startedAt,
    });
    return fallbackToFetch(config);
  }

  const selectedIp = await getSelectedIpForHost(hostname);

  // If no IP mapping found, use native fetch
  if (!selectedIp) {
    logHealthCheckSniDecision('info', {
      hostname,
      method,
      sniSupported,
      proxyActive: proxyActive === null ? 'null' : proxyActive,
      preflightReason:
        proxyActive === null
          ? 'preflight_unsupported_legacy'
          : 'confirmed_direct',
      hasSelectedIp: false,
      decision: 'fetch',
      reason: 'no_selected_ip',
      durationMs: Date.now() - startedAt,
    });
    return fallbackToFetch(config);
  }

  // Use SNI direct IP connection
  logHealthCheckSniDecision('info', {
    hostname,
    method,
    sniSupported,
    proxyActive: proxyActive === null ? 'null' : proxyActive,
    preflightReason:
      proxyActive === null
        ? 'preflight_unsupported_legacy'
        : 'confirmed_direct',
    hasSelectedIp: true,
    selectedIpHash: hashForLog(selectedIp),
    decision: 'sni',
    reason: 'selected_ip',
    durationMs: Date.now() - startedAt,
  });

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
      logHealthCheckSniDecision('warn', {
        hostname,
        method,
        sniSupported,
        proxyActive: proxyActive === null ? 'null' : proxyActive,
        preflightReason:
          proxyActive === null
            ? 'preflight_unsupported_legacy'
            : 'confirmed_direct',
        hasSelectedIp: true,
        selectedIpHash: hashForLog(selectedIp),
        decision: 'fetch',
        reason: 'sni_null_response',
        durationMs: Date.now() - startedAt,
      });
      return await fallbackToFetch(config);
    }

    logHealthCheckSniDecision('info', {
      hostname,
      method,
      sniSupported,
      proxyActive: proxyActive === null ? 'null' : proxyActive,
      preflightReason:
        proxyActive === null
          ? 'preflight_unsupported_legacy'
          : 'confirmed_direct',
      hasSelectedIp: true,
      selectedIpHash: hashForLog(selectedIp),
      decision: 'sni',
      reason: 'success',
      statusCode: sniResponse.statusCode,
      durationMs: Date.now() - startedAt,
    });
    return {
      status: sniResponse.statusCode,
      ok: sniResponse.statusCode >= 200 && sniResponse.statusCode < 300,
    };
  } catch (error) {
    if (isSniFailClosedError(error)) {
      logHealthCheckSniDecision('error', {
        hostname,
        method,
        sniSupported,
        proxyActive: proxyActive === null ? 'null' : proxyActive,
        preflightReason:
          proxyActive === null
            ? 'preflight_unsupported_legacy'
            : 'confirmed_direct',
        hasSelectedIp: true,
        selectedIpHash: hashForLog(selectedIp),
        decision: 'throw',
        reason: 'fail_closed',
        errorCode: getErrorCode(error),
        errorMessage: getErrorMessage(error),
        durationMs: Date.now() - startedAt,
      });
      throw error;
    }

    logHealthCheckSniDecision('warn', {
      hostname,
      method,
      sniSupported,
      proxyActive: proxyActive === null ? 'null' : proxyActive,
      preflightReason:
        proxyActive === null
          ? 'preflight_unsupported_legacy'
          : 'confirmed_direct',
      hasSelectedIp: true,
      selectedIpHash: hashForLog(selectedIp),
      decision: 'fetch',
      reason: 'sni_error',
      errorCode: getErrorCode(error),
      errorMessage: getErrorMessage(error),
      durationMs: Date.now() - startedAt,
    });
    return fallbackToFetch(config);
  }
}
