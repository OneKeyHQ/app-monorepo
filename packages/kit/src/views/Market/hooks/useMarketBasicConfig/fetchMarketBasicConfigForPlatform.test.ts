import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import type { IMarketBasicConfigResponse } from '@onekeyhq/shared/types/marketV2';

import {
  clearMarketBasicConfigForPlatformCache,
  fetchMarketBasicConfigForPlatform,
  getCachedMarketBasicConfigForPlatform,
  getLastMarketBasicConfigForPlatform,
  subscribeMarketBasicConfigForPlatform,
} from './fetchMarketBasicConfigForPlatform';

jest.mock('@onekeyhq/kit/src/background/instance/backgroundApiProxy', () => ({
  __esModule: true,
  default: {
    serviceMarketV2: {
      fetchMarketBasicConfig: jest.fn(),
    },
  },
}));

const response: IMarketBasicConfigResponse = {
  code: 0,
  message: '',
  data: {
    tradingViewUrl: 'https://example.com',
    networkList: [],
    recommendTokens: [],
    searchRecommendTokens: [],
    refreshInterval: 5,
    minLiquidity: 5000,
  },
};

describe('fetchMarketBasicConfigForPlatform', () => {
  const fetchMarketBasicConfigMock = jest.spyOn(
    backgroundApiProxy.serviceMarketV2,
    'fetchMarketBasicConfig',
  );

  beforeEach(() => {
    clearMarketBasicConfigForPlatformCache();
    fetchMarketBasicConfigMock.mockReset();
    fetchMarketBasicConfigMock.mockResolvedValue(response);
  });

  it('deduplicates concurrent main-to-background requests', async () => {
    const firstRequest = fetchMarketBasicConfigForPlatform();
    const secondRequest = fetchMarketBasicConfigForPlatform();

    await expect(firstRequest).resolves.toBe(response);
    await expect(secondRequest).resolves.toBe(response);
    expect(fetchMarketBasicConfigMock).toHaveBeenCalledTimes(1);
  });

  it('makes prefetched config synchronously available to the chart', async () => {
    await fetchMarketBasicConfigForPlatform();

    expect(getCachedMarketBasicConfigForPlatform()).toBe(response);
    expect(getLastMarketBasicConfigForPlatform()).toBe(response);
  });

  it('notifies source subscribers after config recovery', async () => {
    const listener = jest.fn();
    const unsubscribe = subscribeMarketBasicConfigForPlatform(listener);

    await fetchMarketBasicConfigForPlatform();

    expect(listener).toHaveBeenCalledWith(response);
    unsubscribe();
  });
});
