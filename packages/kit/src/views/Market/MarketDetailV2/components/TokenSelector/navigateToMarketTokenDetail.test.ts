import { rootNavigationRef } from '@onekeyhq/components';
import { fetchMarketTokenDetailWithCache } from '@onekeyhq/kit/src/states/jotai/contexts/marketV2/marketTokenDetailInFlightRequest';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import {
  prefetchMarketDetailV2FirstScreenKLine,
  prefetchMarketDetailV2FirstScreenTransactions,
  prepareMarketDetailV2KlineSource,
} from '../../utils/marketDetailPagePreload';

import {
  navigateToMarketTokenDetail,
  prefetchMarketTokenSelection,
} from './navigateToMarketTokenDetail';

jest.mock('@onekeyhq/components', () => ({
  rootNavigationRef: { current: { navigate: jest.fn() } },
}));

jest.mock(
  '@onekeyhq/kit/src/states/jotai/contexts/marketV2/marketTokenDetailInFlightRequest',
  () => ({
    fetchMarketTokenDetailWithCache: jest.fn(() => Promise.resolve()),
  }),
);

jest.mock('@onekeyhq/shared/src/platformEnv', () => ({
  __esModule: true,
  default: { isNative: false },
}));

jest.mock('@onekeyhq/shared/src/routes', () => ({
  ERootRoutes: { Main: 'Main' },
  ETabMarketRoutes: { MarketDetailV2: 'MarketDetailV2' },
  ETabRoutes: { Discovery: 'Discovery', Market: 'Market' },
}));

jest.mock('@onekeyhq/shared/src/utils/networkUtils', () => ({
  __esModule: true,
  default: { getNetworkShortCode: jest.fn() },
}));

jest.mock('../../utils/marketDetailImagePreload', () => ({
  prewarmMarketTokenDetailPreviewImages: jest.fn(),
}));

jest.mock('../../utils/marketDetailPagePreload', () => ({
  prepareMarketDetailV2KlineSource: jest.fn(),
  prefetchMarketDetailV2FirstScreenKLine: jest.fn(() => Promise.resolve()),
  prefetchMarketDetailV2FirstScreenTransactions: jest.fn(() =>
    Promise.resolve(),
  ),
}));

const mockRootNavigationRef = rootNavigationRef as unknown as {
  current: {
    navigate: jest.Mock;
  };
};

describe('prefetchMarketTokenSelection', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (
      platformEnv as typeof platformEnv & {
        isNative: boolean;
      }
    ).isNative = false;
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('starts token detail, kline, and transaction prefetches together', () => {
    prefetchMarketTokenSelection({
      address: '0x1234',
      networkId: 'evm--1',
      firstTradeTime: 123,
    });

    expect(prepareMarketDetailV2KlineSource).toHaveBeenCalledWith({
      tokenAddress: '0x1234',
      networkId: 'evm--1',
    });
    expect(fetchMarketTokenDetailWithCache).toHaveBeenCalledWith({
      tokenAddress: '0x1234',
      networkId: 'evm--1',
    });
    expect(prefetchMarketDetailV2FirstScreenKLine).toHaveBeenCalledWith({
      tokenAddress: '0x1234',
      networkId: 'evm--1',
      historyStartTime: 123,
    });
    expect(prefetchMarketDetailV2FirstScreenTransactions).toHaveBeenCalledWith({
      tokenAddress: '0x1234',
      networkId: 'evm--1',
    });
  });

  it('starts prefetch immediately but defers native navigation', () => {
    jest.useFakeTimers();
    (
      platformEnv as typeof platformEnv & {
        isNative: boolean;
      }
    ).isNative = true;
    const beforeNavigate = jest.fn();
    const changeActiveToken = jest.fn();

    navigateToMarketTokenDetail(
      {
        address: '0x1234',
        networkId: 'evm--1',
      },
      {
        beforeNavigate,
        tokenDetailActions: {
          current: {
            changeActiveToken,
          },
        } as never,
      },
    );

    expect(prefetchMarketDetailV2FirstScreenKLine).toHaveBeenCalledTimes(1);
    expect(beforeNavigate).toHaveBeenCalledTimes(1);
    expect(mockRootNavigationRef.current.navigate).not.toHaveBeenCalled();

    jest.advanceTimersByTime(100);

    expect(mockRootNavigationRef.current.navigate).toHaveBeenCalledTimes(1);
  });
});
