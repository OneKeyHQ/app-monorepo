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
    const response: ISniResponse =
      await desktopApiProxy.sniRequest.request(config);

    return response;
  } catch (error) {
    if (isSniFailClosedError(error)) {
      throw error;
    }
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

/**
 * Check if Electron will route the target URL through a proxy.
 * null means the desktop API is unavailable or too old for this preflight.
 */
export async function isProxyActiveForUrl(
  url: string,
): Promise<boolean | null> {
  if (!platformEnv.isDesktop) {
    return null;
  }

  const desktopApiProxy = globalThis.desktopApiProxy;
  const preflight = desktopApiProxy?.sniRequest?.isProxyActiveForUrl;
  if (typeof preflight !== 'function') {
    return null;
  }

  try {
    return await preflight.call(desktopApiProxy.sniRequest, url);
  } catch (error) {
    console.warn('[SNI Desktop] Proxy preflight failed:', {
      url,
      error: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
}

function isSniFailClosedError(error: unknown): boolean {
  const code =
    error && typeof error === 'object' && 'code' in error
      ? String((error as { code?: unknown }).code)
      : '';
  const message = error instanceof Error ? error.message : String(error);
  return (
    [
      'SNI_INVALID_CONFIG',
      'SNI_SECURITY_POLICY_FAILED',
      'SNI_TLS_FAILED',
      'SNI_CERT_FAILED',
      'SNI_RESPONSE_FAILED',
      'SNI_RESOURCE_LIMIT',
      'SNI_CANCELLED',
    ].includes(code) ||
    /SNI_(INVALID_CONFIG|SECURITY_POLICY_FAILED|TLS_FAILED|CERT_FAILED|RESPONSE_FAILED|RESOURCE_LIMIT|CANCELLED)/.test(
      message,
    ) ||
    /certificate|tls|ssl|unsafe header|forbidden ip|invalid config|response body too large/i.test(
      message,
    )
  );
}
