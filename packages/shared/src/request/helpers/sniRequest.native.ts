import { request as nativeSniRequest } from '@onekeyfe/react-native-sni-connect';

import { OneKeyLocalError } from '../../errors';

import type { ISniRequestConfig, ISniResponse } from '../types/ipTable';

type ISniConnectMethod =
  | 'GET'
  | 'HEAD'
  | 'POST'
  | 'PUT'
  | 'PATCH'
  | 'DELETE'
  | 'OPTIONS';

type INativeSniRequestConfig = Parameters<typeof nativeSniRequest>[0];

function normalizeSniRequestMethod(method: string): ISniConnectMethod {
  switch (method.toUpperCase()) {
    case 'GET':
      return 'GET';
    case 'HEAD':
      return 'HEAD';
    case 'POST':
      return 'POST';
    case 'PUT':
      return 'PUT';
    case 'PATCH':
      return 'PATCH';
    case 'DELETE':
      return 'DELETE';
    case 'OPTIONS':
      return 'OPTIONS';
    default:
      throw new OneKeyLocalError(`Unsupported SNI request method: ${method}`);
  }
}

function buildNativeSniRequest(
  config: ISniRequestConfig,
): INativeSniRequestConfig {
  const method = normalizeSniRequestMethod(config.method);
  const baseConfig = {
    ip: config.ip,
    hostname: config.hostname,
    path: config.path,
    headers: config.headers,
    timeout: config.timeout,
  };

  switch (method) {
    case 'GET':
    case 'HEAD':
      return {
        ...baseConfig,
        method,
      };
    case 'POST':
    case 'PUT':
    case 'PATCH':
      return {
        ...baseConfig,
        method,
        body: config.body ?? '',
      };
    case 'DELETE':
    case 'OPTIONS':
      return {
        ...baseConfig,
        method,
        body: config.body,
      };
  }

  throw new OneKeyLocalError('Unsupported SNI request method');
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
