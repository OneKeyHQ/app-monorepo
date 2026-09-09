const TRADINGVIEW_RECOVERY_MANIFEST_QUERY_KEY =
  '__onekey_tradingview_recovery_manifest__';

function getTradingViewRecoveryManifestRequest(manifestUrl) {
  const recoveryUrl = new URL(manifestUrl);
  recoveryUrl.searchParams.set(TRADINGVIEW_RECOVERY_MANIFEST_QUERY_KEY, '1');
  return new Request(recoveryUrl);
}

export async function cacheTradingViewRecoveryManifest(
  cache,
  manifestUrl,
  manifestResponse,
) {
  await cache.put(
    getTradingViewRecoveryManifestRequest(manifestUrl),
    manifestResponse.clone(),
  );
}

export async function matchTradingViewRecoveryManifest(cache, manifestUrl) {
  const recoveryResponse = await cache.match(
    getTradingViewRecoveryManifestRequest(manifestUrl),
  );
  if (recoveryResponse) {
    return recoveryResponse;
  }
  // Existing complete caches predate the separate recovery marker.
  return cache.match(new Request(manifestUrl));
}
