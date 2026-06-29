import * as nativeSniConnect from '@onekeyfe/react-native-sni-connect';

import { defaultLogger } from '../../logger/logger';

import type { ISniRequestConfig, ISniResponse } from '../types/ipTable';

/**
 * SNI Request - Native implementation for iOS/Android
 * Uses @onekeyfe/react-native-sni-connect to perform direct IP connection with SNI
 */
export async function sniRequest(
  config: ISniRequestConfig,
): Promise<ISniResponse | null> {
  const response = await nativeSniConnect.request({
    requestId: config.requestId,
    ip: config.ip,
    hostname: config.hostname,
    path: config.path,
    headers: config.headers,
    method: config.method,
    body: config.body,
    timeout: config.timeout,
  });
  const multiValueHeaders = (
    response as typeof response & {
      multiValueHeaders?: Record<string, string[]>;
    }
  ).multiValueHeaders;

  return {
    data: response.data,
    status: response.status,
    statusText: response.statusText,
    statusCode: response.status,
    headers: response.headers,
    multiValueHeaders,
    body: response.data,
  };
}

/**
 * Check if SNI is supported on current platform
 * @returns true for Native platforms (iOS/Android)
 */
export function isSniSupported(): boolean {
  return true;
}

/**
 * Check if Native will route the target URL through a proxy.
 * null means the installed native module does not expose the preflight yet.
 */
export async function isProxyActiveForUrl(
  url: string,
): Promise<boolean | null> {
  const preflight = (
    nativeSniConnect as unknown as {
      isProxyActiveForUrl?: (targetUrl: string) => Promise<boolean>;
    }
  ).isProxyActiveForUrl;

  if (typeof preflight !== 'function') {
    logAdapterCapability('warn', {
      adapter: 'native',
      capability: 'preflight',
      available: false,
      decision: 'fallback',
      hostname: getHostnameForLog(url),
    });
    return null;
  }

  try {
    return await preflight(url);
  } catch (error) {
    logAdapterCapability('warn', {
      adapter: 'native',
      capability: 'preflight',
      available: true,
      decision: 'fallback',
      hostname: getHostnameForLog(url),
      errorMessage: getErrorMessage(error),
    });
    return null;
  }
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
  const info = `[SNI Native] ${Object.entries({
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
