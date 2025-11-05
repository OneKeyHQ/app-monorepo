import type { ISniRequestConfig, ISniResponse } from '../types/ipTable';

/**
 * SNI Request - Desktop implementation for Electron
 * TODO: Implement using Electron's net module for direct IP connection
 * Currently returns null as placeholder
 */
export async function sniRequest(
  config: ISniRequestConfig,
): Promise<ISniResponse | null> {
  // TODO: Implement Desktop SNI request using Electron net module
  // Reference: https://www.electronjs.org/docs/latest/api/net
  return null;
}

/**
 * Check if SNI is supported on current platform
 * @returns false until Desktop implementation is complete
 */
export function isSniSupported(): boolean {
  return false; // TODO: Change to true after implementation
}
