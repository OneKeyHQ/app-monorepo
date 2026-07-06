import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { defaultLogger } from '../../logger/logger';

import { isSniFailClosedError } from './sniFailClosedError';
import { safeSniLogValue } from './sniLogRedaction';

import type { ISniRequestConfig, ISniResponse } from '../types/ipTable';

const DESKTOP_SNI_PREFLIGHT_NOT_FOUND_RE =
  /callRemoteApiMethod not found:\s*desktopApi\.sniRequest\.isProxyActiveForUrl\(\)/;

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
 * null means the desktop API is unavailable or too old for this preflight,
 * so callers can preserve the legacy SNI path instead of silently disabling it.
 */
export async function isProxyActiveForUrl(
  url: string,
): Promise<boolean | null> {
  if (!platformEnv.isDesktop) {
    return null;
  }

  const desktopApiProxy = globalThis.desktopApiProxy;
  const sniRequestProxy = desktopApiProxy?.sniRequest;
  if (typeof sniRequestProxy?.isProxyActiveForUrl !== 'function') {
    logAdapterCapability('warn', {
      adapter: 'desktop',
      capability: 'preflight',
      available: false,
      decision: 'legacy_sni',
      hostname: getHostnameForLog(url),
    });
    return null;
  }

  try {
    return await sniRequestProxy.isProxyActiveForUrl(url);
  } catch (error) {
    if (isDesktopSniPreflightCapabilityMissing(error)) {
      logAdapterCapability('warn', {
        adapter: 'desktop',
        capability: 'preflight',
        available: false,
        decision: 'legacy_sni',
        hostname: getHostnameForLog(url),
        errorMessage: getErrorMessage(error),
      });
      return null;
    }

    logAdapterCapability('error', {
      adapter: 'desktop',
      capability: 'preflight',
      available: true,
      decision: 'fallback',
      hostname: getHostnameForLog(url),
      errorMessage: getErrorMessage(error),
    });
    throw error;
  }
}

function isDesktopSniPreflightCapabilityMissing(error: unknown): boolean {
  return DESKTOP_SNI_PREFLIGHT_NOT_FOUND_RE.test(getErrorMessage(error));
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
