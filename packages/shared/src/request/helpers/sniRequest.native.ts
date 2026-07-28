import {
  type SniConnectMethod,
  type SniConnectBodylessMethod as SniConnectNoBodyMethod,
  type SniConnectOptionalBodyMethod,
  type SniConnectRequest,
  type SniConnectRequiredBodyMethod,
  isProxyActiveForUrl as nativeIsProxyActiveForUrl,
  request as nativeSniRequest,
} from '@onekeyfe/react-native-sni-connect';

import { defaultLogger } from '../../logger/logger';

import { safeSniLogValue } from './sniLogRedaction';

import type { ISniRequestConfig, ISniResponse } from '../types/ipTable';

const SNI_CONNECT_NO_BODY_METHODS = [
  'GET',
  'HEAD',
] as const satisfies readonly SniConnectNoBodyMethod[];
const SNI_CONNECT_REQUIRED_BODY_METHODS = [
  'POST',
  'PUT',
  'PATCH',
] as const satisfies readonly SniConnectRequiredBodyMethod[];
const SNI_CONNECT_OPTIONAL_BODY_METHODS = [
  'DELETE',
  'OPTIONS',
] as const satisfies readonly SniConnectOptionalBodyMethod[];
const SNI_CONNECT_METHODS = [
  ...SNI_CONNECT_NO_BODY_METHODS,
  ...SNI_CONNECT_REQUIRED_BODY_METHODS,
  ...SNI_CONNECT_OPTIONAL_BODY_METHODS,
] as const satisfies readonly SniConnectMethod[];

function isSniConnectMethod(method: string): method is SniConnectMethod {
  return (SNI_CONNECT_METHODS as readonly string[]).includes(method);
}

function isNoBodyMethod(
  method: SniConnectMethod,
): method is SniConnectNoBodyMethod {
  return (SNI_CONNECT_NO_BODY_METHODS as readonly SniConnectMethod[]).includes(
    method,
  );
}

function isRequiredBodyMethod(
  method: SniConnectMethod,
): method is SniConnectRequiredBodyMethod {
  return (
    SNI_CONNECT_REQUIRED_BODY_METHODS as readonly SniConnectMethod[]
  ).includes(method);
}

/**
 * SNI Request - Native implementation for iOS/Android
 * Uses @onekeyfe/react-native-sni-connect to perform direct IP connection with SNI
 */
export async function sniRequest(
  config: ISniRequestConfig,
): Promise<ISniResponse | null> {
  const response = await nativeSniRequest(buildNativeSniRequest(config));
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

class SniInvalidConfigError extends Error {
  code = 'SNI_INVALID_CONFIG' as const;

  constructor(message: string) {
    super(message);
    this.name = 'SniInvalidConfigError';
  }
}

function buildNativeSniRequest(config: ISniRequestConfig): SniConnectRequest {
  const method = normalizeSniMethod(config.method);
  const base = {
    requestId: config.requestId,
    ip: config.ip,
    hostname: config.hostname,
    path: config.path,
    headers: config.headers,
    timeout: config.timeout,
  };

  if (isNoBodyMethod(method)) {
    return {
      ...base,
      method,
    };
  }

  if (isRequiredBodyMethod(method)) {
    return {
      ...base,
      method,
      body: config.body ?? '',
    };
  }

  return {
    ...base,
    method,
    body: config.body,
  };
}

function normalizeSniMethod(method: string): SniConnectMethod {
  const normalizedMethod = method.trim().toUpperCase();
  if (isSniConnectMethod(normalizedMethod)) {
    return normalizedMethod;
  }

  throw new SniInvalidConfigError(`Invalid SNI request method: ${method}`);
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
 * null means the installed native module does not expose the preflight yet,
 * so OTA JS must preserve the legacy SNI path for older binaries.
 */
export async function isProxyActiveForUrl(
  url: string,
): Promise<boolean | null> {
  const preflight = nativeIsProxyActiveForUrl as unknown as
    | ((targetUrl: string) => Promise<boolean>)
    | undefined;

  if (typeof preflight !== 'function') {
    logAdapterCapability('warn', {
      adapter: 'native',
      capability: 'preflight',
      available: false,
      decision: 'legacy_sni',
      hostname: getHostnameForLog(url),
    });
    return null;
  }

  try {
    return await preflight(url);
  } catch (error) {
    logAdapterCapability('error', {
      adapter: 'native',
      capability: 'preflight',
      available: true,
      decision: 'fallback',
      hostname: getHostnameForLog(url),
      errorMessage: getErrorMessage(error),
    });
    throw error;
  }
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
