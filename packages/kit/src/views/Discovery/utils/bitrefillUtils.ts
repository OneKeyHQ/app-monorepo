export const BITREFILL_EMBED_ORIGIN = 'https://embed.bitrefill.com';
export const BITREFILL_REF_CODE = 'bronekey01';

// EVM-only payment method identifiers accepted by Bitrefill's embed widget.
// These identifiers are Bitrefill's own naming (not OneKey's) — see the
// paymentMethods enum in Bitrefill's embed docs. Non-EVM methods (bitcoin,
// lightning, usdc_solana, usdt_trc20, etc.) are intentionally excluded
// because OneKey currently only has a native parser for ethereum: URIs.
// Not every EVM pair is listed (e.g. usdt_base, usdc_bsc) because Bitrefill
// does not support them as of 2026-04-15; add as they become available.
const EVM_PAYMENT_METHODS = [
  'ethereum',
  'eth_base',
  'usdc_erc20',
  'usdc_polygon',
  'usdc_arbitrum',
  'usdc_base',
  'usdt_erc20',
  'usdt_polygon',
  'usdt_arbitrum',
  'usdt_bsc',
];

export function getBitrefillEmbedUrl(): string {
  const params = new URLSearchParams({
    ref: BITREFILL_REF_CODE,
    utm_source: 'onekey',
    paymentMethods: EVM_PAYMENT_METHODS.join(','),
  });
  return `${BITREFILL_EMBED_ORIGIN}/?${params.toString()}`;
}

/**
 * Bitrefill embed widget communicates with its host via raw window.postMessage,
 * which does not flow through OneKey's JSBridge. We inject a small listener
 * inside the webview page that forwards these raw postMessages as $private
 * JSBridge REQUESTs, so they reach our customReceiveHandler on the host side.
 */
export const BITREFILL_BRIDGE_METHOD = 'wallet_bitrefillEvent';

export const BITREFILL_BRIDGE_SCRIPT = `
(function() {
  try {
    var hasApi = !!(window.$onekey && window.$onekey.$private && typeof window.$onekey.$private.request === 'function');
    function ping(stage, payload) {
      try {
        if (hasApi) {
          window.$onekey.$private.request({
            method: 'wallet_bitrefillDebug',
            params: [{ stage: stage, payload: payload }],
          }).catch(function(){});
        }
      } catch (_e) {}
    }

    if (window.__onekeyBitrefillBridgeInstalled) {
      ping('install:skipped', { reason: 'already installed' });
      return;
    }
    window.__onekeyBitrefillBridgeInstalled = true;

    ping('install:start', { hasApi: hasApi, loc: location.href });

    window.addEventListener('message', function(e) {
      try {
        ping('message:received', {
          origin: e.origin,
          hasData: typeof e.data === 'object' && e.data !== null,
          event: (e.data && typeof e.data === 'object') ? e.data.event : null,
        });
        if (e.origin !== '${BITREFILL_EMBED_ORIGIN}') return;
        var data = e.data;
        if (!data || typeof data !== 'object' || !data.event) return;
        var api = window.$onekey && window.$onekey.$private;
        if (!api || typeof api.request !== 'function') return;
        api.request({
          method: '${BITREFILL_BRIDGE_METHOD}',
          params: [data],
        }).catch(function(){});
      } catch (_e) {
        ping('message:error', { message: String(_e && _e.message) });
      }
    });

    ping('install:done', null);
  } catch (_e) {}
})();
true;
`;

export function isBitrefillEmbedUrl(url: string | undefined | null): boolean {
  if (!url) return false;
  try {
    return new URL(url).origin === BITREFILL_EMBED_ORIGIN;
  } catch {
    return false;
  }
}
