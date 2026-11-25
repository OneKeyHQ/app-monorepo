/** @jest-environment jsdom */

import { renderHook } from '@testing-library/react';

import {
  EEnterWay,
  EMarketEntryCategory,
} from '@onekeyhq/shared/src/logger/scopes/dex';
import {
  EMarketHomeEntrySource,
  MARKET_DETAIL_LEFT_TTL_MS,
  MARKET_HOME_ENTRY_TTL_MS,
  markMarketDetailLeft,
  markMarketHomeEntry,
  resetMarketHomeEntryState,
} from '@onekeyhq/shared/src/logger/scopes/market/marketHomeEntry';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import {
  useMarketDetailLeaveAnalytics,
  useMarketEnterAnalytics,
  useMarketHomeViewAnalytics,
} from './useMarketEnterAnalytics';

const mockDexEnter = jest.fn();
const mockMarketHomeView = jest.fn();
let mockParams: Record<string, unknown> = {};

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
      },
    },
    market: {
      home: {
        marketHomeView: (payload: unknown) => {
          mockMarketHomeView(payload);
        },
      },
    },
  },
}));
jest.mock('@onekeyhq/shared/src/platformEnv', () => ({
  __esModule: true,
  default: { isWeb: false },
}));
jest.mock('../utils/marketDetailNavigation', () => {
  const actual = jest.requireActual<
    typeof import('../utils/marketDetailNavigation')
  >('../utils/marketDetailNavigation');
  return { isInitialSectionConsumed: actual.isInitialSectionConsumed };
});

describe('useMarketEnterAnalytics', () => {
  beforeEach(() => {
    mockDexEnter.mockClear();
  });

  it('records one entry when the one-shot Overview request is consumed', () => {
    mockParams = {
      stockId: 'AAPL',
      from: EEnterWay.SwapStock,
      initialSection: 'overview',
    };
    const { rerender } = renderHook(() => useMarketEnterAnalytics());
    expect(mockDexEnter).toHaveBeenCalledTimes(1);
    expect(mockDexEnter).toHaveBeenCalledWith({
      enterWay: EEnterWay.SwapStock,
    });

    mockParams = { stockId: 'AAPL', from: EEnterWay.SwapStock };
    rerender();
    expect(mockDexEnter).toHaveBeenCalledTimes(1);

    // A real new entry still counts.
    mockParams = {
      stockId: 'AAPL',
      from: EEnterWay.SwapStock,
      initialSection: 'overview',
    };
    rerender();
    expect(mockDexEnter).toHaveBeenCalledTimes(2);
  });
});

describe('useMarketEnterAnalytics list context', () => {
  beforeEach(() => {
    mockDexEnter.mockClear();
  });

  it('reports the Market list category with the entry', () => {
    mockParams = {
      tokenAddress: '0xabc',
      network: 'eth',
      from: EEnterWay.MarketList,
      marketTokenCategory: 'hot',
    };
    renderHook(() => useMarketEnterAnalytics());
    expect(mockDexEnter).toHaveBeenCalledWith({
      enterWay: EEnterWay.MarketList,
      marketTokenCategory: 'hot',
    });
  });
});

describe('useMarketEnterAnalytics category fallback', () => {
  beforeEach(() => {
    mockDexEnter.mockClear();
  });

  it.each([
    ['a stock list', EMarketEntryCategory.Stocks],
    ['a watchlist', EMarketEntryCategory.Watchlist],
    ['a stock row in a spot category', 'hot'],
  ])(
    'reports the entry category of %s as marketTokenCategory',
    (_, category) => {
      mockParams = {
        stockId: 'AAPL',
        from: EEnterWay.MarketList,
        entryCategory: category,
      };
      renderHook(() => useMarketEnterAnalytics());
      expect(mockDexEnter).toHaveBeenCalledWith({
        enterWay: EEnterWay.MarketList,
        marketTokenCategory: category,
      });
    },
  );

  it('prefers the entry category over the route category', () => {
    mockParams = {
      tokenAddress: '0xabc',
      network: 'eth',
      from: EEnterWay.MarketList,
      marketTokenCategory: 'hot',
      entryCategory: EMarketEntryCategory.Watchlist,
    };
    renderHook(() => useMarketEnterAnalytics());
    expect(mockDexEnter).toHaveBeenCalledWith({
      enterWay: EEnterWay.MarketList,
      marketTokenCategory: EMarketEntryCategory.Watchlist,
    });
  });

  it('keeps the route category when the entry has none', () => {
    mockParams = {
      tokenAddress: '0xabc',
      network: 'eth',
      from: EEnterWay.MarketList,
      marketTokenCategory: 'hot',
    };
    renderHook(() => useMarketEnterAnalytics());
    expect(mockDexEnter).toHaveBeenCalledWith({
      enterWay: EEnterWay.MarketList,
      marketTokenCategory: 'hot',
    });
  });

  it('reports the Highlights entry without a category', () => {
    mockParams = { stockId: 'AAPL', from: EEnterWay.Highlights };
    renderHook(() => useMarketEnterAnalytics());
    expect(mockDexEnter).toHaveBeenCalledWith({
      enterWay: EEnterWay.Highlights,
    });
  });
});

describe('useMarketDetailLeaveAnalytics', () => {
  beforeEach(() => {
    mockMarketHomeView.mockClear();
    resetMarketHomeEntryState();
  });

  it('flags the removal of a detail route for the home below it', () => {
    let beforeRemove: (() => void) | undefined;
    const unsubscribe = jest.fn();
    const navigation = {
      addListener: jest.fn((type: string, callback: () => void) => {
        if (type === 'beforeRemove') beforeRemove = callback;
        return unsubscribe;
      }),
    };
    const detail = renderHook(() =>
      useMarketDetailLeaveAnalytics(
        navigation as unknown as Parameters<
          typeof useMarketDetailLeaveAnalytics
        >[0],
      ),
    );
    expect(navigation.addListener).toHaveBeenCalledWith(
      'beforeRemove',
      expect.any(Function),
    );
    beforeRemove?.();
    detail.unmount();
    expect(unsubscribe).toHaveBeenCalledTimes(1);

    renderHook(() => useMarketHomeViewAnalytics(true));
    expect(mockMarketHomeView).toHaveBeenCalledWith({
      entrySource: EMarketHomeEntrySource.DetailBack,
      isFirstView: true,
    });
  });
});

describe('useMarketHomeViewAnalytics', () => {
  beforeEach(() => {
    mockMarketHomeView.mockClear();
    resetMarketHomeEntryState();
    platformEnv.isWeb = false;
  });
  afterAll(() => {
    platformEnv.isWeb = false;
  });

  it('reports a first view without a marker as landing on web only', () => {
    platformEnv.isWeb = true;
    const { rerender } = renderHook(
      ({ isFocused }: { isFocused: boolean }) =>
        useMarketHomeViewAnalytics(isFocused),
      { initialProps: { isFocused: true } },
    );
    expect(mockMarketHomeView).toHaveBeenLastCalledWith({
      entrySource: EMarketHomeEntrySource.Landing,
      isFirstView: true,
    });
    // Returns after the first view stay silent on web too.
    rerender({ isFocused: false });
    rerender({ isFocused: true });
    expect(mockMarketHomeView).toHaveBeenCalledTimes(1);
  });

  it('keeps a marked first view on web', () => {
    platformEnv.isWeb = true;
    markMarketHomeEntry(EMarketHomeEntrySource.TabBar);
    renderHook(() => useMarketHomeViewAnalytics(true));
    expect(mockMarketHomeView).toHaveBeenCalledWith({
      entrySource: EMarketHomeEntrySource.TabBar,
      isFirstView: true,
    });
  });

  it('reports a first view revealed by leaving a detail as detailBack', () => {
    const { rerender } = renderHook(
      ({ isFocused }: { isFocused: boolean }) =>
        useMarketHomeViewAnalytics(isFocused),
      { initialProps: { isFocused: false } },
    );
    expect(mockMarketHomeView).not.toHaveBeenCalled();
    markMarketDetailLeft();
    rerender({ isFocused: true });
    expect(mockMarketHomeView).toHaveBeenCalledWith({
      entrySource: EMarketHomeEntrySource.DetailBack,
      isFirstView: true,
    });

    // A later back from a detail is still not an entry.
    rerender({ isFocused: false });
    markMarketDetailLeft();
    rerender({ isFocused: true });
    expect(mockMarketHomeView).toHaveBeenCalledTimes(1);
  });

  it('prefers detailBack over landing on web', () => {
    platformEnv.isWeb = true;
    markMarketDetailLeft();
    renderHook(() => useMarketHomeViewAnalytics(true));
    expect(mockMarketHomeView).toHaveBeenCalledWith({
      entrySource: EMarketHomeEntrySource.DetailBack,
      isFirstView: true,
    });
  });

  it('prefers a fresh marker over leaving a detail', () => {
    markMarketDetailLeft();
    markMarketHomeEntry(EMarketHomeEntrySource.TabBar);
    renderHook(() => useMarketHomeViewAnalytics(true));
    expect(mockMarketHomeView).toHaveBeenCalledWith({
      entrySource: EMarketHomeEntrySource.TabBar,
      isFirstView: true,
    });
  });

  it('ignores a stale detail flag', () => {
    markMarketDetailLeft(Date.now() - MARKET_DETAIL_LEFT_TTL_MS - 1);
    renderHook(() => useMarketHomeViewAnalytics(true));
    expect(mockMarketHomeView).toHaveBeenCalledWith({
      entrySource: EMarketHomeEntrySource.Other,
      isFirstView: true,
    });
  });

  it('does not report a remount without a new marker as an entry', () => {
    // Tablet split layouts unmount and remount the home on rotation.
    const first = renderHook(() => useMarketHomeViewAnalytics(true));
    expect(mockMarketHomeView).toHaveBeenCalledTimes(1);
    first.unmount();
    renderHook(() => useMarketHomeViewAnalytics(true));
    expect(mockMarketHomeView).toHaveBeenCalledTimes(1);

    markMarketHomeEntry(EMarketHomeEntrySource.TabBar);
    const remounted = renderHook(() => useMarketHomeViewAnalytics(true));
    expect(mockMarketHomeView).toHaveBeenCalledTimes(2);
    expect(mockMarketHomeView).toHaveBeenLastCalledWith({
      entrySource: EMarketHomeEntrySource.TabBar,
      isFirstView: false,
    });
    remounted.unmount();
  });

  it('reports the first view, skips returns, and reports marked entries', () => {
    const { rerender } = renderHook(
      ({ isFocused }: { isFocused: boolean }) =>
        useMarketHomeViewAnalytics(isFocused),
      { initialProps: { isFocused: true } },
    );
    expect(mockMarketHomeView).toHaveBeenCalledTimes(1);
    expect(mockMarketHomeView).toHaveBeenLastCalledWith({
      entrySource: EMarketHomeEntrySource.Other,
      isFirstView: true,
    });

    // Back from a detail page or a modal: no marker, not a new entry.
    rerender({ isFocused: false });
    rerender({ isFocused: true });
    expect(mockMarketHomeView).toHaveBeenCalledTimes(1);

    rerender({ isFocused: false });
    markMarketHomeEntry(EMarketHomeEntrySource.Discovery);
    rerender({ isFocused: true });
    expect(mockMarketHomeView).toHaveBeenCalledTimes(2);
    expect(mockMarketHomeView).toHaveBeenLastCalledWith({
      entrySource: EMarketHomeEntrySource.Discovery,
      isFirstView: false,
    });
  });

  it('reports a later keyboard-shortcut entry after the first view', () => {
    const { rerender } = renderHook(
      ({ isFocused }: { isFocused: boolean }) =>
        useMarketHomeViewAnalytics(isFocused),
      { initialProps: { isFocused: true } },
    );
    rerender({ isFocused: false });
    markMarketHomeEntry(EMarketHomeEntrySource.Shortcut);
    rerender({ isFocused: true });
    expect(mockMarketHomeView).toHaveBeenCalledTimes(2);
    expect(mockMarketHomeView).toHaveBeenLastCalledWith({
      entrySource: EMarketHomeEntrySource.Shortcut,
      isFirstView: false,
    });
  });

  it('uses a marker set before the home mounted on its first focus', () => {
    markMarketHomeEntry(EMarketHomeEntrySource.TabBar);
    renderHook(() => useMarketHomeViewAnalytics(true));
    expect(mockMarketHomeView).toHaveBeenCalledWith({
      entrySource: EMarketHomeEntrySource.TabBar,
      isFirstView: true,
    });
  });

  it('ignores a marker from a navigation that never landed', () => {
    const now = Date.now();
    markMarketHomeEntry(
      EMarketHomeEntrySource.WalletHome,
      now - MARKET_HOME_ENTRY_TTL_MS - 1,
    );
    renderHook(() => useMarketHomeViewAnalytics(true));
    expect(mockMarketHomeView).toHaveBeenCalledWith({
      entrySource: EMarketHomeEntrySource.Other,
      isFirstView: true,
    });
  });
});
