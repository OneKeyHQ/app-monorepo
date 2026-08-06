const PREFETCH_MESSAGE_TYPE = 'PREFETCH_TRADINGVIEW_EMBED';

export function warmTradingViewEmbedAssets() {
  const controller = navigator.serviceWorker?.controller;
  if (!controller) {
    return;
  }
  controller.postMessage({
    type: PREFETCH_MESSAGE_TYPE,
    payload: {
      publicUrl: process.env.PUBLIC_URL || '/',
    },
  });
}
