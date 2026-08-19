import type { IMarketTokenDetailResponse } from '@onekeyhq/shared/types/marketV2';

import {
  clearMarketTokenDetailRequestCache,
  fetchMarketTokenDetailWithCache,
} from './marketTokenDetailInFlightRequest';

const mockFetchMarketTokenDetail = jest.fn(
  (..._args: unknown[]) =>
    new Promise<IMarketTokenDetailResponse>(() => undefined),
);

jest.mock('@onekeyhq/kit/src/background/instance/backgroundApiProxy', () => ({
  __esModule: true,
  default: {
    serviceMarketV2: {
      fetchMarketTokenDetailByTokenAddress: (...args: unknown[]) =>
        mockFetchMarketTokenDetail(...args),
    },
  },
}));

describe('fetchMarketTokenDetailWithCache', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    clearMarketTokenDetailRequestCache();
  });

  it('deduplicates requests in the same display currency', () => {
    const firstRequest = fetchMarketTokenDetailWithCache({
      tokenAddress: '0x1234',
      networkId: 'evm--1',
      currencyId: 'CNY',
    });
    const secondRequest = fetchMarketTokenDetailWithCache({
      tokenAddress: '0x1234',
      networkId: 'evm--1',
      currencyId: 'cny',
    });

    expect(firstRequest).toBe(secondRequest);
    expect(mockFetchMarketTokenDetail).toHaveBeenCalledTimes(1);
    expect(mockFetchMarketTokenDetail).toHaveBeenCalledWith(
      '0x1234',
      'evm--1',
      { currencyId: 'cny' },
    );
  });

  it('does not share requests across display currencies', () => {
    const cnyRequest = fetchMarketTokenDetailWithCache({
      tokenAddress: '0x1234',
      networkId: 'evm--1',
      currencyId: 'cny',
    });
    const eurRequest = fetchMarketTokenDetailWithCache({
      tokenAddress: '0x1234',
      networkId: 'evm--1',
      currencyId: 'eur',
    });

    expect(cnyRequest).not.toBe(eurRequest);
    expect(mockFetchMarketTokenDetail).toHaveBeenNthCalledWith(
      1,
      '0x1234',
      'evm--1',
      {
        currencyId: 'cny',
      },
    );
    expect(mockFetchMarketTokenDetail).toHaveBeenNthCalledWith(
      2,
      '0x1234',
      'evm--1',
      {
        currencyId: 'eur',
      },
    );
  });
});
