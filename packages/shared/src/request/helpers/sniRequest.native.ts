import { request as nativeSniRequest } from '@onekeyfe/react-native-sni-connect';

import type { ISniRequestConfig, ISniResponse } from '../types/ipTable';

/**
 * SNI Request - Native implementation for iOS/Android
 * Uses @onekeyfe/react-native-sni-connect to perform direct IP connection with SNI
 */
export async function sniRequest(
  config: ISniRequestConfig,
): Promise<ISniResponse | null> {
  const response = await nativeSniRequest({
    ip: config.ip,
    hostname: config.hostname,
    path: config.path,
    headers: config.headers,
    method: config.method,
    body: config.body,
    timeout: config.timeout,
  });

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
