/** @jest-environment jsdom */

import type { ReactNode } from 'react';

import { renderHook } from '@testing-library/react';

import { MARKET_TOP_COINS_CATEGORY_ID } from '@onekeyhq/shared/src/consts/marketConsts';

import {
  MarketDetailAnalyticsProvider,
  createMarketDetailVisitTimer,
  logMarketDetailChartModeSwitch,
  mergeMarketDetailAnalyticsAsset,
  resolveMarketDetailAnalyticsAsset,
  useMarketDetailChartAnalytics,
} from './marketDetailAnalytics';

const mockTradingView = {
  dexChartModeSwitch: jest.fn(),
  dexChartDisplayModeSwitch: jest.fn(),
  dexNativeChartInterval: jest.fn(),
  dexSimpleChartRange: jest.fn(),
};

jest.mock('@onekeyhq/shared/src/logger/logger', () => ({
  defaultLogger: {
    dex: {
      tradingView: {
        dexChartModeSwitch: (payload: unknown) => {
          mockTradingView.dexChartModeSwitch(payload);
        },
        dexChartDisplayModeSwitch: (payload: unknown) => {
          mockTradingView.dexChartDisplayModeSwitch(payload);
        },
        dexNativeChartInterval: (payload: unknown) => {
          mockTradingView.dexNativeChartInterval(payload);
        },
        dexSimpleChartRange: (payload: unknown) => {
          mockTradingView.dexSimpleChartRange(payload);
        },
      },
    },
  },
}));

jest.mock('@onekeyhq/shared/src/utils/networkUtils', () => ({
  __esModule: true,
  default: {
    getNetworkIdFromShortCode: ({ shortCode }: { shortCode: string }) =>
      shortCode === 'eth' ? 'evm--1' : '',
  },
}));

describe('resolveMarketDetailAnalyticsAsset', () => {
  it('reports a token by its Market id, network id and symbol', () => {
    expect(
      resolveMarketDetailAnalyticsAsset({
        tokenAddress: '0xabc',
        network: 'eth',
        marketTokenId: 'pepe',
        marketTokenCategory: 'hot',
        legacyTokenPreview: {
          address: '0xabc',
          networkId: 'evm--1',
          name: 'Pepe',
          symbol: 'PEPE',
          decimals: 18,
          selectedAt: 1,
        },
      }),
    ).toEqual({
      detailKind: 'trending',
      tokenSymbol: 'PEPE',
      network: 'evm--1',
      marketAssetId: 'pepe',
    });
  });

  it('takes the kind from the asset, not from the list it was opened in', () => {
    expect(
      resolveMarketDetailAnalyticsAsset({
        tokenAddress: '',
        network: 'btc',
        marketTokenId: 'btc',
        marketTokenCategory: MARKET_TOP_COINS_CATEGORY_ID,
        entryCategory: 'watchlist',
      }),
    ).toEqual({
      detailKind: 'topCoin',
      network: 'btc',
      marketAssetId: 'btc',
    });
    expect(
      resolveMarketDetailAnalyticsAsset({
        tokenAddress: '0xabc',
        network: 'evm--1',
        entryCategory: 'stocks',
      }).detailKind,
    ).toBe('trending');
  });

  it('reports a stock by its stock id and preview symbol', () => {
    expect(
      resolveMarketDetailAnalyticsAsset({
        stockId: 'AAPL.US',
        stockPreviewSymbol: 'AAPL',
        tokenAddress: '0xstock',
        network: 'eth',
      }),
    ).toEqual({
      detailKind: 'stock',
      tokenSymbol: 'AAPL',
      network: 'evm--1',
      marketAssetId: 'AAPL.US',
    });
  });

  it('identifies an in-app trending entry without a Market id by its contract', () => {
    expect(
      resolveMarketDetailAnalyticsAsset({
        tokenAddress: '0xabc',
        network: 'eth',
        marketTokenCategory: 'trending',
        from: 'marketList',
      }),
    ).toEqual({
      detailKind: 'trending',
      network: 'evm--1',
      marketAssetId: '0xabc',
    });
  });

  it('never takes the contract of an external link as the asset id', () => {
    const linkParams = {
      tokenAddress: '0xabc',
      network: 'eth',
      marketTokenCategory: 'trending',
    };
    const external = {
      detailKind: 'trending',
      network: 'evm--1',
    };
    expect(resolveMarketDetailAnalyticsAsset(linkParams)).toEqual(external);
    // The caller's entry source wins over the params' own `from`.
    expect(
      resolveMarketDetailAnalyticsAsset(
        { ...linkParams, from: 'marketList' },
        { isInAppEntry: false },
      ),
    ).toEqual(external);
    expect(
      resolveMarketDetailAnalyticsAsset(linkParams, { isInAppEntry: true }),
    ).toEqual({ ...external, marketAssetId: '0xabc' });
  });

  it('sends only what an unresolved asset entry knows', () => {
    expect(
      resolveMarketDetailAnalyticsAsset({
        tokenAddress: '',
        network: '',
        marketTokenId: 'btc',
        pendingMarketAsset: { symbol: 'BTC' },
      }),
    ).toEqual({
      detailKind: 'trending',
      tokenSymbol: 'BTC',
      marketAssetId: 'btc',
    });
  });

  it('falls back to a matching preview symbol and the swap lookup symbol', () => {
    expect(
      resolveMarketDetailAnalyticsAsset(
        { tokenAddress: '0xabc', network: 'eth' },
        { fallbackSymbol: 'ABC' },
      ).tokenSymbol,
    ).toBe('ABC');
    expect(
      resolveMarketDetailAnalyticsAsset({
        tokenAddress: '',
        network: 'eth',
        swapTokenSymbol: 'ETH',
      }).tokenSymbol,
    ).toBe('ETH');
  });

  it('keeps known fields when resolved params leave them out', () => {
    expect(
      mergeMarketDetailAnalyticsAsset(
        { detailKind: 'trending', tokenSymbol: 'BTC', marketAssetId: 'btc' },
        { detailKind: 'trending', network: 'btc', marketAssetId: 'btc' },
      ),
    ).toEqual({
      detailKind: 'trending',
      tokenSymbol: 'BTC',
      network: 'btc',
      marketAssetId: 'btc',
    });
  });
});

describe('createMarketDetailVisitTimer', () => {
  it('counts only active stretches', () => {
    let now = 1000;
    const timer = createMarketDetailVisitTimer({
      isActive: true,
      now: () => now,
    });
    now = 4000;
    timer.setActive(false);
    now = 60_000;
    // Repeated inactive reports do not move the clock.
    timer.setActive(false);
    timer.setActive(true);
    timer.setActive(true);
    now = 62_500;
    expect(timer.getDurationMs()).toBe(5500);
  });

  it('reads the monotonic clock by default', () => {
    let now = 500;
    const performanceNow = jest
      .spyOn(globalThis.performance, 'now')
      .mockImplementation(() => now);
    const dateNow = jest.spyOn(Date, 'now');
    try {
      const timer = createMarketDetailVisitTimer({ isActive: true });
      now = 3500;
      expect(timer.getDurationMs()).toBe(3000);
      expect(dateNow).not.toHaveBeenCalled();
    } finally {
      performanceNow.mockRestore();
      dateNow.mockRestore();
    }
  });

  it('starts paused for an entry that opens inactive', () => {
    let now = 0;
    const timer = createMarketDetailVisitTimer({
      isActive: false,
      now: () => now,
    });
    now = 10_000;
    expect(timer.getDurationMs()).toBe(0);
    timer.setActive(true);
    now = 12_000;
    expect(timer.getDurationMs()).toBe(2000);
  });
});

describe('Market detail chart analytics', () => {
  beforeEach(() => {
    Object.values(mockTradingView).forEach((fn) => fn.mockClear());
  });

  function wrapper({ children }: { children?: ReactNode }) {
    return (
      <MarketDetailAnalyticsProvider detailKind="stock">
        {children}
      </MarketDetailAnalyticsProvider>
    );
  }

  it('reports changes on a Market detail page only', () => {
    const { result } = renderHook(() => useMarketDetailChartAnalytics(), {
      wrapper,
    });
    result.current?.onChartDisplayModeSwitch('simple', 'pro');
    result.current?.onChartDisplayModeSwitch('pro', 'pro');
    result.current?.onSimpleChartRangeSelect('1D', '1W');
    result.current?.onSimpleChartRangeSelect('1W', '1W');
    result.current?.onNativeChartIntervalSelect('60');

    expect(mockTradingView.dexChartDisplayModeSwitch).toHaveBeenCalledTimes(1);
    expect(mockTradingView.dexChartDisplayModeSwitch).toHaveBeenCalledWith({
      fromMode: 'simple',
      toMode: 'pro',
      detailKind: 'stock',
    });
    expect(mockTradingView.dexSimpleChartRange).toHaveBeenCalledTimes(1);
    expect(mockTradingView.dexSimpleChartRange).toHaveBeenCalledWith({
      rangeSelect: '1W',
      detailKind: 'stock',
    });
    expect(mockTradingView.dexNativeChartInterval).toHaveBeenCalledWith({
      intervalSelect: '60',
      detailKind: 'stock',
    });
  });

  it('stays silent outside a Market detail page', () => {
    const { result } = renderHook(() => useMarketDetailChartAnalytics());
    expect(result.current).toBeUndefined();
  });

  it('reports the Pro chart renderer switch with both modes', () => {
    logMarketDetailChartModeSwitch({
      fromMode: 'native',
      detailKind: 'topCoin',
    });
    expect(mockTradingView.dexChartModeSwitch).toHaveBeenCalledWith({
      fromMode: 'native',
      toMode: 'tradingView',
      detailKind: 'topCoin',
    });
  });
});
