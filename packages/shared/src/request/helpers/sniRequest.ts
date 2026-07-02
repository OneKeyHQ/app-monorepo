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

/**
 * Check if a platform proxy is active for the target URL.
 * null means this platform cannot provide a reliable per-URL proxy preflight,
 * so callers should preserve the legacy SNI path when SNI itself is supported.
 */
export async function isProxyActiveForUrl(
  _url: string,
): Promise<boolean | null> {
  return null;
}
