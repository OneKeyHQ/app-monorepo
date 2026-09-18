import { verifyTradingViewEmbedAssetResponse } from './tradingViewEmbedAssetIntegrity';

export async function putTradingViewResponseInCache(cache, request, response) {
  try {
    await cache.put(request, response.clone());
    return true;
  } catch {
    // A verified response remains usable when storage is unavailable.
    return false;
  }
}

export async function matchVerifiedTradingViewCachedResponse(
  cache,
  request,
  asset,
) {
  const cachedResponse = await cache.match(request);
  if (!cachedResponse) {
    return undefined;
  }
  try {
    return await verifyTradingViewEmbedAssetResponse(cachedResponse, asset);
  } catch {
    try {
      await cache.delete(request);
    } catch {
      // Eviction is best-effort; never return an unverified body.
    }
    return undefined;
  }
}

export async function cacheTradingViewCompletionMarker(
  cache,
  manifestRequest,
  manifestResponse,
  assetsCached,
) {
  if (!assetsCached) {
    return false;
  }
  await cache.put(manifestRequest, manifestResponse.clone());
  return true;
}
