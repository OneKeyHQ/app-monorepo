import type { ISniRequestConfig, ISniResponse } from '../types/ipTable';

/**
 * SNI Request - Default implementation for Web/Extension
 * Web and Extension platforms don't support direct IP connection with SNI
 * @returns null to indicate SNI is not supported on this platform
 */
export async function sniRequest(
  _config: ISniRequestConfig,
): Promise<ISniResponse | null> {
  return null; // Web/Extension don't support SNI direct connection
}

/**
 * Check if SNI is supported on current platform
 * @returns false for Web/Extension platforms
 */
export function isSniSupported(): boolean {
  return false;
}

export function subscribeToLogs(_callback: (log: any) => void): () => void {
  // No-op for Web/Extension platforms
  return () => {};
}
