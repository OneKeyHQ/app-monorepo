import {
  type SniConnectMethod,
  type SniConnectBodylessMethod as SniConnectNoBodyMethod,
  type SniConnectOptionalBodyMethod,
  type SniConnectRequest,
  type SniConnectRequiredBodyMethod,
  request as nativeSniRequest,
} from '@onekeyfe/react-native-sni-connect';

import { OneKeyLocalError } from '../../errors';

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

function normalizeSniConnectMethod(method: string): SniConnectMethod {
  const normalizedMethod = method.toUpperCase();
  if (isSniConnectMethod(normalizedMethod)) {
    return normalizedMethod;
  }

  throw new OneKeyLocalError(`[SNI Native] Unsupported method: ${method}`);
}

function buildNativeSniRequest(config: ISniRequestConfig): SniConnectRequest {
  const method = normalizeSniConnectMethod(config.method);
  const requestBase = {
    ip: config.ip,
    hostname: config.hostname,
    path: config.path,
    headers: config.headers,
    timeout: config.timeout,
  };

  if (isNoBodyMethod(method)) {
    return {
      ...requestBase,
      method,
    };
  }

  if (isRequiredBodyMethod(method)) {
    return {
      ...requestBase,
      method,
      body: config.body ?? '',
    };
  }

  return {
    ...requestBase,
    method,
    body: config.body,
  };
}

/**
 * SNI Request - Native implementation for iOS/Android
 * Uses @onekeyfe/react-native-sni-connect to perform direct IP connection with SNI
 */
export async function sniRequest(
  config: ISniRequestConfig,
): Promise<ISniResponse | null> {
  const response = await nativeSniRequest(buildNativeSniRequest(config));

  return {
    statusCode: response.status,
    headers: response.headers,
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
