import { fetchMarketBasicConfigLight } from '../../utils/marketLightApi';

let inFlightRequest: ReturnType<typeof fetchMarketBasicConfigLight> | undefined;
let cachedResponse:
  | {
      response: Awaited<ReturnType<typeof fetchMarketBasicConfigLight>>;
      cachedAt: number;
    }
  | undefined;
// Keep the list's last source mapping available after the request-cache TTL so
// click navigation can choose the detail chart datafeed synchronously.
let lastResolvedResponse:
  | Awaited<ReturnType<typeof fetchMarketBasicConfigLight>>
  | undefined;

export const MARKET_BASIC_CONFIG_CACHE_TTL_MS = 30_000;

const getCachedMarketBasicConfigForPlatform = () => {
  if (
    cachedResponse &&
    Date.now() - cachedResponse.cachedAt < MARKET_BASIC_CONFIG_CACHE_TTL_MS
  ) {
    return cachedResponse.response;
  }

  cachedResponse = undefined;
  return undefined;
};

const fetchMarketBasicConfigForPlatform = () => {
  const freshCachedResponse = getCachedMarketBasicConfigForPlatform();
  if (freshCachedResponse) {
    return Promise.resolve(freshCachedResponse);
  }

  if (inFlightRequest) {
    return inFlightRequest;
  }

  const request = fetchMarketBasicConfigLight().then((response) => {
    cachedResponse = { response, cachedAt: Date.now() };
    lastResolvedResponse = response;
    return response;
  });
  inFlightRequest = request;

  const removeRequest = () => {
    if (inFlightRequest === request) {
      inFlightRequest = undefined;
    }
  };
  void request.then(removeRequest, removeRequest);

  return request;
};

const clearMarketBasicConfigForPlatformCache = () => {
  cachedResponse = undefined;
  lastResolvedResponse = undefined;
  inFlightRequest = undefined;
};

const getLastMarketBasicConfigForPlatform = () => lastResolvedResponse;

export {
  clearMarketBasicConfigForPlatformCache,
  fetchMarketBasicConfigForPlatform,
  getCachedMarketBasicConfigForPlatform,
  getLastMarketBasicConfigForPlatform,
};
