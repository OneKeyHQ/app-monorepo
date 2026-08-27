export async function putTradingViewResponseInCache(cache, request, response) {
  try {
    await cache.put(request, response.clone());
    return true;
  } catch {
    // A verified response remains usable when storage is unavailable.
    return false;
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
