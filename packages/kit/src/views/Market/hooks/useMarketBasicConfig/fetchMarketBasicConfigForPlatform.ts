import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import type { IMarketBasicConfigResponse } from '@onekeyhq/shared/types/marketV2';

let inFlightRequest: Promise<IMarketBasicConfigResponse> | undefined;
let cachedResponse:
  | { response: IMarketBasicConfigResponse; cachedAt: number }
  | undefined;
// Keep the last source mapping after the short request-cache TTL so navigation
// can still select the chart provider synchronously.
let lastResolvedResponse: IMarketBasicConfigResponse | undefined;
const responseListeners = new Set<
  (response: IMarketBasicConfigResponse) => void
>();

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

  const request = backgroundApiProxy.serviceMarketV2
    .fetchMarketBasicConfig()
    .then((response) => {
      cachedResponse = { response, cachedAt: Date.now() };
      lastResolvedResponse = response;
      responseListeners.forEach((listener) => listener(response));
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

const subscribeMarketBasicConfigForPlatform = (
  listener: (response: IMarketBasicConfigResponse) => void,
) => {
  responseListeners.add(listener);
  return () => responseListeners.delete(listener);
};

export {
  clearMarketBasicConfigForPlatformCache,
  fetchMarketBasicConfigForPlatform,
  getCachedMarketBasicConfigForPlatform,
  getLastMarketBasicConfigForPlatform,
  subscribeMarketBasicConfigForPlatform,
};
