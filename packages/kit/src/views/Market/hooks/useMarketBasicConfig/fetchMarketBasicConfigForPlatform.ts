import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import type { IMarketBasicConfigResponse } from '@onekeyhq/shared/types/marketV2';

let inFlightRequest: Promise<IMarketBasicConfigResponse> | undefined;
let cachedResponse:
  | { response: IMarketBasicConfigResponse; cachedAt: number }
  | undefined;
// Keep the list's last source mapping available after the request-cache TTL so
// click navigation can choose the detail chart datafeed synchronously.
let lastResolvedResponse: IMarketBasicConfigResponse | undefined;

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
