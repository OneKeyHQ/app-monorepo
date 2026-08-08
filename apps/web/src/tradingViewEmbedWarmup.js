const PREFETCH_MESSAGE_TYPE = 'PREFETCH_TRADINGVIEW_EMBED';
const DEFAULT_MANIFEST_URL = 'https://tradingview.onekey.so/embed/latest.json';

export function warmTradingViewEmbedAssets() {
  const manifestUrl =
    process.env.TRADINGVIEW_EMBED_MANIFEST_URL || DEFAULT_MANIFEST_URL;
  const controller = navigator.serviceWorker?.controller;
  if (!controller) {
    return;
  }
  controller.postMessage({
    type: PREFETCH_MESSAGE_TYPE,
    payload: {
      manifestUrl,
    },
  });
}
