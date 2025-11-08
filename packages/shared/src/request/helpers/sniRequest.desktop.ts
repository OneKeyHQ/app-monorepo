import platformEnv from '@onekeyhq/shared/src/platformEnv';

import type { ISniRequestConfig, ISniResponse } from '../types/ipTable';

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
      return null;
    }

    // Call main process via proxy
    const response: ISniResponse = await desktopApiProxy.sniRequest.request(
      config,
    );

    return response;
  } catch (error) {
    // Log error and return null to trigger fallback to default adapter
    console.error('[SNI Desktop] Request failed:', {
      hostname: config.hostname,
      ip: config.ip,
      error: error instanceof Error ? error.message : String(error),
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

export function subscribeToLogs(_callback: (log: any) => void): () => void {
  // No-op for Desktop platforms
  return () => {};
}
