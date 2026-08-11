const PREFETCH_MESSAGE_TYPE = 'PREFETCH_TRADINGVIEW_EMBED';
const DEFAULT_MANIFEST_URL = 'https://tradingview.onekey.so/embed/latest.json';

let warming = false;

function shouldWarmTradingViewEmbed() {
  return (
    document.visibilityState === 'visible' &&
    navigator.connection?.saveData !== true
  );
}

async function getPinnedTradingViewEmbedManifest() {
  const buildManifestUrl =
    process.env.TRADINGVIEW_EMBED_BUILD_MANIFEST_URL?.trim() || '';
  const buildManifestIntegrity =
    process.env.TRADINGVIEW_EMBED_BUILD_MANIFEST_INTEGRITY?.trim() || '';
  if (!buildManifestUrl || !buildManifestIntegrity.startsWith('sha384-')) {
    return undefined;
  }
  try {
    const response = await fetch(buildManifestUrl, {
      cache: 'force-cache',
      credentials: 'omit',
      integrity: buildManifestIntegrity,
      mode: 'cors',
    });
    return response.ok ? await response.json() : undefined;
  } catch {
    return undefined;
  }
}

export function warmTradingViewEmbedAssets() {
  const manifestUrl =
    process.env.TRADINGVIEW_EMBED_MANIFEST_URL || DEFAULT_MANIFEST_URL;
  const hasPinnedManifest = Boolean(
    process.env.TRADINGVIEW_EMBED_BUILD_MANIFEST_URL?.trim(),
  );
  const controller = navigator.serviceWorker?.controller;
  if (
    !controller ||
    !hasPinnedManifest ||
    warming ||
    !shouldWarmTradingViewEmbed()
  ) {
    return;
  }
  // No idle deferral: the heavy work (bootstrap download + hashing) runs on
  // the service-worker thread; the only main-thread cost here is a tiny
  // same-origin JSON fetch. The SW also self-starts a locale-agnostic warmup
  // on its first intercepted request, so this message mainly re-checks the
  // version and lets repeated triggers (visibilitychange, 30-min interval)
  // pick up a new release; the SW dedupes by version internally.
  warming = true;
  void getPinnedTradingViewEmbedManifest().then((manifest) => {
    warming = false;
    const currentController = navigator.serviceWorker?.controller;
    if (!currentController || !manifest || !shouldWarmTradingViewEmbed()) {
      return;
    }
    currentController.postMessage({
      type: PREFETCH_MESSAGE_TYPE,
      payload: {
        manifestUrl,
        manifestVersion: manifest.version,
      },
    });
  });
}
