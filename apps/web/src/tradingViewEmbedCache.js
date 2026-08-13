export async function putTradingViewResponseInCache(cache, request, response) {
  try {
    await cache.put(request, response.clone());
  } catch {
    // A verified response remains usable when storage is unavailable.
  }
}
