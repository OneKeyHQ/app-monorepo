/**
 * WalletConnect Pay hosts its compliance data-collection form on
 * pay.walletconnect.com and officially supports embedding it in an iframe
 * (completion is reported to the parent window via postMessage). Its CSP
 * `frame-ancestors https:` only admits https ancestors, which rejects the
 * desktop renderer origin (file:// in production, http://localhost in dev).
 * These helpers let the main process strip ONLY the frame-blocking headers
 * for that trusted host so the embed loads; every other CSP directive stays
 * enforced by Chromium.
 */

// Keep in sync with WALLET_CONNECT_PAY_TRUSTED_HOST in
// packages/shared/src/walletConnect/payConstant.ts — not imported here because
// that module pulls react-native into the Electron main-process bundle.
const WC_PAY_TRUSTED_HOST = 'pay.walletconnect.com';

export function isWcPayEmbedUrl(url: string): boolean {
  try {
    const { protocol, hostname } = new URL(url);
    if (protocol !== 'https:') {
      return false;
    }
    const host = hostname.toLowerCase();
    return (
      host === WC_PAY_TRUSTED_HOST || host.endsWith(`.${WC_PAY_TRUSTED_HOST}`)
    );
  } catch {
    return false;
  }
}

function removeFrameAncestorsDirective(cspValue: string): string {
  return cspValue
    .split(';')
    .filter((directive) => {
      const name = directive.trim().toLowerCase();
      return !name.startsWith('frame-ancestors');
    })
    .map((directive) => directive.trim())
    .join('; ');
}

export function stripFrameBlockingHeaders(
  responseHeaders: Record<string, string[]> | undefined,
): Record<string, string[]> | undefined {
  if (!responseHeaders) {
    return responseHeaders;
  }
  const result: Record<string, string[]> = {};
  for (const [key, values] of Object.entries(responseHeaders)) {
    const lowerKey = key.toLowerCase();
    if (lowerKey === 'content-security-policy') {
      const stripped = values
        .map(removeFrameAncestorsDirective)
        .filter((v) => v.length > 0);
      if (stripped.length > 0) {
        result[key] = stripped;
      }
    } else if (lowerKey !== 'x-frame-options') {
      result[key] = values;
    }
  }
  return result;
}
