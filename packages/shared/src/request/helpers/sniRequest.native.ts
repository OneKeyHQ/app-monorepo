import {
  request as nativeSniRequest,
  subscribeToLogs as nativeSubscribeToLogs,
} from '@onekeyfe/react-native-sni-connect';

import type { ISniRequestConfig, ISniResponse } from '../types/ipTable';
import type { LogEntry } from '@onekeyfe/react-native-sni-connect';

/**
 * Subscribe to SNI connection logs for debugging
 * @param callback - Function to call when new log entries are available
 * @returns Unsubscribe function
 */
export function subscribeToLogs(callback: (log: LogEntry) => void): () => void {
  return nativeSubscribeToLogs(callback);
}

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
