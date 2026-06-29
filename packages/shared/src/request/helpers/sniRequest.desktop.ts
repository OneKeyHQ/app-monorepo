import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { defaultLogger } from '../../logger/logger';

import type { ISniRequestConfig, ISniResponse } from '../types/ipTable';

/**
 * SNI Request - Desktop implementation for Electron
 * Calls main process via desktopApiProxy for actual SNI request
 */
export async function sniRequest(
  config: ISniRequestConfig,
): Promise<ISniResponse | null> {
  // Check if running in desktop environment
  if (!platformEnv.isDesktop) {
    return null;
  }

  try {
    // Get desktopApiProxy from global scope
    const desktopApiProxy = globalThis.desktopApiProxy;

    if (!desktopApiProxy?.sniRequest) {
      logAdapterCapability('warn', {
        adapter: 'desktop',
        capability: 'request',
        available: false,
        decision: 'null',
        hostname: config.hostname,
        ipHash: hashForLog(config.ip),
      });
      return null;
    }

    // Call main process via proxy
    const response: ISniResponse =
      await desktopApiProxy.sniRequest.request(config);

    return response;
  } catch (error) {
    if (isSniFailClosedError(error)) {
      throw error;
    }
    logAdapterCapability('error', {
      adapter: 'desktop',
      capability: 'request',
      available: true,
      decision: 'null',
      hostname: config.hostname,
      ipHash: hashForLog(config.ip),
      errorMessage: getErrorMessage(error),
    });

    return null;
  }
}

/**
 * Check if SNI is supported on current platform
 * @returns true if desktop environment with desktopApiProxy available
 */
export function isSniSupported(): boolean {
  if (!platformEnv.isDesktop) {
    return false;
  }

  // Check if desktopApiProxy is available
  const desktopApiProxy = globalThis.desktopApiProxy;
  return !!desktopApiProxy?.sniRequest;
}

/**
 * Check if Electron will route the target URL through a proxy.
 * null means the desktop API is unavailable or too old for this preflight.
 */
export async function isProxyActiveForUrl(
  url: string,
): Promise<boolean | null> {
  if (!platformEnv.isDesktop) {
    return null;
  }

  const desktopApiProxy = globalThis.desktopApiProxy;
  const preflight = desktopApiProxy?.sniRequest?.isProxyActiveForUrl;
  if (typeof preflight !== 'function') {
    logAdapterCapability('warn', {
      adapter: 'desktop',
      capability: 'preflight',
      available: false,
      decision: 'fallback',
      hostname: getHostnameForLog(url),
    });
    return null;
  }

  try {
    return await preflight.call(desktopApiProxy.sniRequest, url);
  } catch (error) {
    logAdapterCapability('warn', {
      adapter: 'desktop',
      capability: 'preflight',
      available: true,
      decision: 'fallback',
      hostname: getHostnameForLog(url),
      errorMessage: getErrorMessage(error),
    });
    return null;
  }
}

function hashForLog(value: string | null | undefined): string {
  if (!value) return 'none';
  let hash = 0x811c9dc5;
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash.toString(16).padStart(8, '0');
}

function safeLogValue(value: unknown): string {
  if (value == null) return 'none';
  return String(value).replace(/[\r\n\s]+/g, '_');
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function getHostnameForLog(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return 'unknown';
  }
}

function logAdapterCapability(
  level: 'info' | 'warn' | 'error',
  fields: Record<string, unknown>,
): void {
  const info = `[SNI Desktop] ${Object.entries({
    event: 'sni_adapter_capability',
    ...fields,
  })
    .map(([key, value]) => `${key}=${safeLogValue(value)}`)
    .join(' ')}`;
  if (level === 'error') {
    defaultLogger.ipTable.request.error({ info });
  } else if (level === 'warn') {
    defaultLogger.ipTable.request.warn({ info });
  } else {
    defaultLogger.ipTable.request.info({ info });
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
