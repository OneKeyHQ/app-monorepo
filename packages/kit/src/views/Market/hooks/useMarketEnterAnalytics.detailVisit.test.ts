/** @jest-environment jsdom */

import { act, renderHook } from '@testing-library/react';

import { MARKET_TOP_COINS_CATEGORY_ID } from '@onekeyhq/shared/src/consts/marketConsts';
import {
  EEnterWay,
  EMarketEntryCategory,
} from '@onekeyhq/shared/src/logger/scopes/dex';

import { useMarketEnterAnalytics } from './useMarketEnterAnalytics';

import type { IMarketDetailVisitOptions } from './useMarketEnterAnalytics';

const mockDexEnter = jest.fn();
const mockDexLeave = jest.fn();
let mockParams: Record<string, unknown> = {};
let mockAppVisible = true;
const mockVisibilityListeners = new Set<(visible: boolean) => void>();

jest.mock('@react-navigation/native', () => ({
  useRoute: () => ({ key: 'detail', params: mockParams }),
}));
jest.mock('@onekeyhq/shared/src/logger/logger', () => ({
  defaultLogger: {
    dex: {
      enter: {
        dexEnter: (payload: unknown) => {
          mockDexEnter(payload);
        },
        dexLeave: (payload: unknown) => {
          mockDexLeave(payload);
        },
      },
    },
  },
}));
jest.mock('@onekeyhq/shared/src/platformEnv', () => ({
  __esModule: true,
  default: { isWeb: false },
}));
jest.mock('@onekeyhq/shared/src/utils/networkUtils', () => ({
  __esModule: true,
  default: {
    getNetworkIdFromShortCode: ({ shortCode }: { shortCode: string }) =>
      shortCode === 'eth' ? 'evm--1' : '',
  },
}));
jest.mock('@onekeyhq/shared/src/utils/appVisibility', () => ({
  getCurrentVisibilityState: () => mockAppVisible,
  onVisibilityStateChange: (listener: (visible: boolean) => void) => {
    mockVisibilityListeners.add(listener);
    return () => mockVisibilityListeners.delete(listener);
  },
}));
jest.mock('@onekeyhq/components', () => ({
  rootNavigationRef: { current: undefined },
}));

function setAppVisible(visible: boolean) {
  mockAppVisible = visible;
  act(() => {
    mockVisibilityListeners.forEach((listener) => listener(visible));
  });
}

const tokenParams = {
  tokenAddress: '0xabc',
  network: 'eth',
  marketTokenId: 'pepe',
  pendingMarketAsset: undefined,
  from: EEnterWay.MarketList,
  marketTokenCategory: 'hot',
};

function renderDetail(initial?: Partial<IMarketDetailVisitOptions>) {
  let options: IMarketDetailVisitOptions = {
    isFocused: true,
    chartMode: 'native',
    chartDisplayMode: 'simple',
    ...initial,
  };
  const view = renderHook(() =>
    useMarketEnterAnalytics({ detailVisit: options }),
  );
  return {
    ...view,
    update(next: Partial<IMarketDetailVisitOptions>) {
      options = { ...options, ...next };
      view.rerender();
    },
  };
}

describe('useMarketEnterAnalytics detail visit', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(1_000_000);
    mockDexEnter.mockClear();
    mockDexLeave.mockClear();
    mockAppVisible = true;
    mockVisibilityListeners.clear();
  });
  afterEach(() => {
    jest.useRealTimers();
  });

  it('reports the asset and chart modes with the entry', () => {
    mockParams = tokenParams;
    renderDetail({ fallbackSymbol: 'PEPE' });
    expect(mockDexEnter).toHaveBeenCalledTimes(1);
    expect(mockDexEnter).toHaveBeenCalledWith({
      enterWay: EEnterWay.MarketList,
      marketTokenCategory: 'hot',
      detailKind: 'trending',
      tokenSymbol: 'PEPE',
      network: 'evm--1',
      marketAssetId: 'pepe',
      chartMode: 'native',
      chartDisplayMode: 'simple',
    });
  });

  it('reports the asset for entries without an enter way', () => {
    mockParams = {
      stockId: 'AAPL.US',
      stockPreviewSymbol: 'AAPL',
    };
    renderDetail({ chartMode: 'tradingView', chartDisplayMode: 'pro' });
    expect(mockDexEnter).toHaveBeenCalledWith({
      enterWay: EEnterWay.Others,
      detailKind: 'stock',
      tokenSymbol: 'AAPL',
      marketAssetId: 'AAPL.US',
      chartMode: 'tradingView',
      chartDisplayMode: 'pro',
    });
  });

  it('keeps the top coin kind when the list category wins the category field', () => {
    mockParams = {
      tokenAddress: '',
      network: 'btc',
      marketTokenId: 'btc',
      marketTokenCategory: MARKET_TOP_COINS_CATEGORY_ID,
      from: EEnterWay.MarketList,
      entryCategory: EMarketEntryCategory.Watchlist,
    };
    renderDetail();
    expect(mockDexEnter).toHaveBeenCalledWith(
      expect.objectContaining({
        marketTokenCategory: EMarketEntryCategory.Watchlist,
        detailKind: 'topCoin',
      }),
    );
  });

  it('sends one leave with the foreground time when the screen unmounts', () => {
    mockParams = tokenParams;
    const view = renderDetail();
    expect(mockDexLeave).not.toHaveBeenCalled();
    jest.advanceTimersByTime(5000);
    view.update({ chartDisplayMode: 'pro' });
    jest.advanceTimersByTime(1000);
    view.unmount();
    expect(mockDexLeave).toHaveBeenCalledTimes(1);
    expect(mockDexLeave).toHaveBeenCalledWith({
      enterWay: EEnterWay.MarketList,
      durationMs: 6000,
      detailKind: 'trending',
      network: 'evm--1',
      marketAssetId: 'pepe',
      // Chart modes at leave.
      chartMode: 'native',
      chartDisplayMode: 'pro',
    });
  });

  it('excludes time in background and behind another page', () => {
    mockParams = tokenParams;
    const view = renderDetail();
    jest.advanceTimersByTime(2000);
    setAppVisible(false);
    jest.advanceTimersByTime(60_000);
    setAppVisible(true);
    jest.advanceTimersByTime(3000);
    view.update({ isFocused: false });
    jest.advanceTimersByTime(30_000);
    view.update({ isFocused: true });
    jest.advanceTimersByTime(1000);
    view.unmount();
    expect(mockDexLeave).toHaveBeenCalledTimes(1);
    expect(mockDexLeave.mock.calls[0][0]).toMatchObject({ durationMs: 6000 });
  });

  it('starts paused when the entry opens in background', () => {
    mockAppVisible = false;
    mockParams = tokenParams;
    const view = renderDetail();
    jest.advanceTimersByTime(10_000);
    setAppVisible(true);
    jest.advanceTimersByTime(1500);
    view.unmount();
    expect(mockDexLeave.mock.calls[0][0]).toMatchObject({ durationMs: 1500 });
  });

  it('leaves the previous asset when the screen switches assets', () => {
    mockParams = tokenParams;
    const view = renderDetail();
    jest.advanceTimersByTime(4000);
    mockParams = {
      tokenAddress: '0xdef',
      network: 'eth',
      marketTokenId: 'wif',
      from: EEnterWay.DetailSwitch,
    };
    view.rerender();
    expect(mockDexEnter).toHaveBeenCalledTimes(2);
    expect(mockDexLeave).toHaveBeenCalledTimes(1);
    expect(mockDexLeave).toHaveBeenLastCalledWith(
      expect.objectContaining({
        enterWay: EEnterWay.MarketList,
        marketAssetId: 'pepe',
        durationMs: 4000,
      }),
    );
    // The leave is sent before the next entry.
    expect(mockDexLeave.mock.invocationCallOrder[0]).toBeLessThan(
      mockDexEnter.mock.invocationCallOrder[1],
    );
    jest.advanceTimersByTime(2500);
    view.unmount();
    expect(mockDexLeave).toHaveBeenCalledTimes(2);
    expect(mockDexLeave).toHaveBeenLastCalledWith(
      expect.objectContaining({
        enterWay: EEnterWay.DetailSwitch,
        marketAssetId: 'wif',
        durationMs: 2500,
      }),
    );
  });

  it('keeps one visit when the pending asset resolves', () => {
    const pendingParams = {
      tokenAddress: '',
      network: '',
      marketTokenId: 'btc',
      pendingMarketAsset: { symbol: 'BTC' },
      from: EEnterWay.MarketList,
      entryCategory: EMarketEntryCategory.Watchlist,
    };
    mockParams = pendingParams;
    const view = renderDetail();
    expect(mockDexEnter).toHaveBeenCalledWith({
      enterWay: EEnterWay.MarketList,
      marketTokenCategory: EMarketEntryCategory.Watchlist,
      detailKind: 'trending',
      tokenSymbol: 'BTC',
      marketAssetId: 'btc',
      chartMode: 'native',
      chartDisplayMode: 'simple',
    });
    jest.advanceTimersByTime(3000);
    mockParams = {
      ...pendingParams,
      pendingMarketAsset: undefined,
      network: 'btc',
      isNative: true,
      marketVariantId: 'btc-native',
    };
    view.rerender();
    expect(mockDexEnter).toHaveBeenCalledTimes(1);
    expect(mockDexLeave).not.toHaveBeenCalled();
    jest.advanceTimersByTime(1000);
    view.unmount();
    expect(mockDexLeave).toHaveBeenCalledTimes(1);
    expect(mockDexLeave).toHaveBeenCalledWith(
      expect.objectContaining({
        durationMs: 4000,
        tokenSymbol: 'BTC',
        network: 'btc',
        marketAssetId: 'btc',
      }),
    );
  });

  it('keeps one visit when the one-shot section is consumed', () => {
    mockParams = {
      stockId: 'AAPL.US',
      from: EEnterWay.SwapStock,
      initialSection: 'overview',
    };
    const view = renderDetail();
    mockParams = { stockId: 'AAPL.US', from: EEnterWay.SwapStock };
    view.rerender();
    view.unmount();
    expect(mockDexEnter).toHaveBeenCalledTimes(1);
    expect(mockDexLeave).toHaveBeenCalledTimes(1);
  });

  it('sends no leave and no asset fields without a detail visit', () => {
    mockParams = tokenParams;
    const view = renderHook(() => useMarketEnterAnalytics());
    view.unmount();
    expect(mockDexEnter).toHaveBeenCalledWith({
      enterWay: EEnterWay.MarketList,
      marketTokenCategory: 'hot',
    });
    expect(mockDexLeave).not.toHaveBeenCalled();
    expect(mockVisibilityListeners.size).toBe(0);
  });
});
