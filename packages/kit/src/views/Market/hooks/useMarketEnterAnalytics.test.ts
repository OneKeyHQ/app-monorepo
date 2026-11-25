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
  EModalSwapRoutes,
  ERootRoutes,
  ETabMarketRoutes,
  ETabRoutes,
} from '@onekeyhq/shared/src/routes';

import {
  isMarketTabDetailRoute,
  isPendingMarketAssetResolved,
  markPendingMarketAssetResolved,
} from '../utils/marketDetailNavigation';
import { markMarketHomeDeeplinkEntry } from '../utils/marketHomeEntryNavigation';

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
  return {
    isInitialSectionConsumed: actual.isInitialSectionConsumed,
    isPendingMarketAssetResolved: actual.isPendingMarketAssetResolved,
    markPendingMarketAssetResolved: actual.markPendingMarketAssetResolved,
    isMarketTabDetailRoute: actual.isMarketTabDetailRoute,
  };
});
let mockRootState: unknown;
jest.mock('@onekeyhq/components', () => ({
  rootNavigationRef: {
    current: { getRootState: () => mockRootState },
  },
}));

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

describe('useMarketEnterAnalytics pending asset', () => {
  beforeEach(() => {
    mockDexEnter.mockClear();
  });

  const pendingParams = {
    tokenAddress: '',
    network: '',
    marketTokenId: 'btc',
    pendingMarketAsset: { symbol: 'BTC' },
    from: EEnterWay.MarketList,
    entryCategory: EMarketEntryCategory.Watchlist,
  };

  it('records one entry when the pending asset resolves', () => {
    mockParams = pendingParams;
    const { rerender } = renderHook(() => useMarketEnterAnalytics());
    expect(mockDexEnter).toHaveBeenCalledTimes(1);

    markPendingMarketAssetResolved(pendingParams.pendingMarketAsset);
    mockParams = {
      ...pendingParams,
      pendingMarketAsset: undefined,
      network: 'btc',
      tokenAddress: '',
      isNative: true,
      marketVariantId: 'btc-native',
    };
    rerender();
    expect(mockDexEnter).toHaveBeenCalledTimes(1);
  });

  it('records one entry when the pending asset falls back to its token', () => {
    mockParams = { ...pendingParams, network: 'eth', tokenAddress: '0xabc' };
    const { rerender } = renderHook(() => useMarketEnterAnalytics());
    markPendingMarketAssetResolved(pendingParams.pendingMarketAsset);
    mockParams = {
      ...pendingParams,
      network: 'eth',
      tokenAddress: '0xabc',
      pendingMarketAsset: undefined,
      marketTokenId: undefined,
      marketVariantId: undefined,
      marketTokenCategory: undefined,
    };
    rerender();
    expect(mockDexEnter).toHaveBeenCalledTimes(1);
  });

  it('records a new selection that clears a still pending asset', () => {
    const switchParams = { ...pendingParams, from: EEnterWay.DetailSwitch };
    delete (switchParams as { entryCategory?: string }).entryCategory;
    mockParams = switchParams;
    const { rerender } = renderHook(() => useMarketEnterAnalytics());
    // The selector replaces the asset before the lookup settles.
    mockParams = {
      tokenAddress: '0xdef',
      network: 'eth',
      from: EEnterWay.DetailSwitch,
      pendingMarketAsset: undefined,
    };
    rerender();
    expect(mockDexEnter).toHaveBeenCalledTimes(2);
  });

  it('records a switch to another asset as a new entry', () => {
    mockParams = {
      tokenAddress: '0xabc',
      network: 'eth',
      from: EEnterWay.MarketList,
    };
    const { rerender } = renderHook(() => useMarketEnterAnalytics());
    mockParams = {
      tokenAddress: '0xdef',
      network: 'eth',
      from: EEnterWay.MarketList,
    };
    rerender();
    expect(mockDexEnter).toHaveBeenCalledTimes(2);
  });

  it('records a different entry that clears the pending asset', () => {
    mockParams = pendingParams;
    const { rerender } = renderHook(() => useMarketEnterAnalytics());
    mockParams = {
      tokenAddress: '0xdef',
      network: 'eth',
      from: EEnterWay.Search,
    };
    rerender();
    expect(mockDexEnter).toHaveBeenCalledTimes(2);
    expect(mockDexEnter).toHaveBeenLastCalledWith({
      enterWay: EEnterWay.Search,
    });
  });
});

describe('isPendingMarketAssetResolved', () => {
  it.each([
    [
      'resolved for the same entry',
      { pendingMarketAsset: { symbol: 'BTC' }, from: EEnterWay.MarketList },
      { from: EEnterWay.MarketList, network: 'btc' },
      true,
    ],
    [
      'still pending',
      { pendingMarketAsset: { symbol: 'BTC' }, from: EEnterWay.MarketList },
      { pendingMarketAsset: { symbol: 'ETH' }, from: EEnterWay.MarketList },
      false,
    ],
    [
      'a different enter way',
      { pendingMarketAsset: { symbol: 'BTC' }, from: EEnterWay.MarketList },
      { from: EEnterWay.Search },
      false,
    ],
    [
      'a different entry category',
      {
        pendingMarketAsset: { symbol: 'BTC' },
        from: EEnterWay.MarketList,
        entryCategory: EMarketEntryCategory.Watchlist,
      },
      { from: EEnterWay.MarketList },
      false,
    ],
    [
      'no pending asset before',
      { from: EEnterWay.MarketList },
      { from: EEnterWay.MarketList, network: 'btc' },
      false,
    ],
  ])('%s', (_, previous, next, expected) => {
    markPendingMarketAssetResolved(
      'pendingMarketAsset' in previous
        ? previous.pendingMarketAsset
        : undefined,
    );
    expect(isPendingMarketAssetResolved(previous, next)).toBe(expected);
  });

  it('is not the lookup when another update cleared the pending asset', () => {
    const previous = {
      pendingMarketAsset: { symbol: 'BTC' },
      from: EEnterWay.DetailSwitch,
    };
    expect(
      isPendingMarketAssetResolved(previous, { from: EEnterWay.DetailSwitch }),
    ).toBe(false);
  });

  it('keeps the lookup marks of two detail screens apart', () => {
    const first = {
      pendingMarketAsset: { symbol: 'BTC' },
      from: EEnterWay.MarketList,
    };
    const second = {
      pendingMarketAsset: { symbol: 'ETH' },
      from: EEnterWay.MarketList,
    };
    markPendingMarketAssetResolved(first.pendingMarketAsset);
    markPendingMarketAssetResolved(second.pendingMarketAsset);
    const next = { from: EEnterWay.MarketList };
    expect(isPendingMarketAssetResolved(first, next)).toBe(true);
    expect(isPendingMarketAssetResolved(second, next)).toBe(true);
  });

  it('consumes the lookup mark once', () => {
    const previous = {
      pendingMarketAsset: { symbol: 'BTC' },
      from: EEnterWay.MarketList,
    };
    const next = { from: EEnterWay.MarketList };
    markPendingMarketAssetResolved(previous.pendingMarketAsset);
    expect(isPendingMarketAssetResolved(previous, next)).toBe(true);
    expect(isPendingMarketAssetResolved(previous, next)).toBe(false);
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
        { isMarketTabDetail: true },
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

describe('useMarketDetailLeaveAnalytics route scope', () => {
  beforeEach(() => {
    mockMarketHomeView.mockClear();
    resetMarketHomeEntryState();
  });

  function removeDetail(routeName: string, stackRouteNames: string[]) {
    let beforeRemove: (() => void) | undefined;
    const navigation = {
      addListener: jest.fn((type: string, callback: () => void) => {
        if (type === 'beforeRemove') beforeRemove = callback;
        return jest.fn();
      }),
    };
    const detail = renderHook(() =>
      useMarketDetailLeaveAnalytics(
        navigation as unknown as Parameters<
          typeof useMarketDetailLeaveAnalytics
        >[0],
        {
          isMarketTabDetail: isMarketTabDetailRoute(routeName, stackRouteNames),
        },
      ),
    );
    beforeRemove?.();
    detail.unmount();
  }

  it.each([
    ETabMarketRoutes.MarketDetailV2,
    ETabMarketRoutes.MarketStockDetail,
    ETabMarketRoutes.MarketNativeDetail,
  ])('arms detailBack when a Market tab %s is removed', (routeName) => {
    removeDetail(routeName, [ETabMarketRoutes.TabMarket, routeName]);
    renderHook(() => useMarketHomeViewAnalytics(true));
    expect(mockMarketHomeView).toHaveBeenCalledWith({
      entrySource: EMarketHomeEntrySource.DetailBack,
      isFirstView: true,
    });
  });

  it.each([
    [
      'the Swap SwapProMarketDetail modal',
      EModalSwapRoutes.SwapProMarketDetail,
      [EModalSwapRoutes.SwapTokenSelect, EModalSwapRoutes.SwapProMarketDetail],
    ],
    [
      'the Market modal detail',
      ETabMarketRoutes.MarketDetailV2,
      ['MarketDetailV2', 'MarketWidgetList'],
    ],
  ])('does not arm detailBack when %s is removed', (_, routeName, names) => {
    removeDetail(routeName, names);
    renderHook(() => useMarketHomeViewAnalytics(true));
    expect(mockMarketHomeView).toHaveBeenCalledWith({
      entrySource: EMarketHomeEntrySource.Other,
      isFirstView: true,
    });
  });

  it.each([
    ['still on its way back to Swap', true, EMarketHomeEntrySource.Other],
    ['back in the Market tab', false, EMarketHomeEntrySource.DetailBack],
  ])(
    'arms detailBack for a Swap stock detail only when it is %s',
    (_, isReturningToSwap, entrySource) => {
      let beforeRemove: (() => void) | undefined;
      const navigation = {
        addListener: jest.fn((type: string, callback: () => void) => {
          if (type === 'beforeRemove') beforeRemove = callback;
          return jest.fn();
        }),
      };
      const detail = renderHook(() =>
        useMarketDetailLeaveAnalytics(
          navigation as unknown as Parameters<
            typeof useMarketDetailLeaveAnalytics
          >[0],
          {
            isMarketTabDetail: true,
            isReturningToSwap: () => isReturningToSwap,
          },
        ),
      );
      beforeRemove?.();
      detail.unmount();
      renderHook(() => useMarketHomeViewAnalytics(true));
      expect(mockMarketHomeView).toHaveBeenCalledWith({
        entrySource,
        isFirstView: true,
      });
    },
  );
});

describe('useMarketHomeViewAnalytics deep link entries', () => {
  beforeEach(() => {
    mockMarketHomeView.mockClear();
    resetMarketHomeEntryState();
    mockRootState = undefined;
  });
  afterAll(() => {
    mockRootState = undefined;
  });

  function rootStateOnTab(tab: ETabRoutes, marketTop = 'TabMarket') {
    return {
      index: 0,
      routes: [
        {
          name: ERootRoutes.Main,
          state: {
            index: tab === ETabRoutes.Market ? 1 : 0,
            routes: [
              { name: tab === ETabRoutes.Market ? ETabRoutes.Home : tab },
              {
                name: ETabRoutes.Market,
                state: {
                  index: marketTop === 'TabMarket' ? 0 : 1,
                  routes: [
                    { name: ETabMarketRoutes.TabMarket },
                    ...(marketTop === 'TabMarket' ? [] : [{ name: marketTop }]),
                  ],
                },
              },
            ],
          },
        },
      ],
    };
  }

  it('reports a first and a later deep link entry in one runtime', () => {
    const { rerender } = renderHook(
      ({ isFocused }: { isFocused: boolean }) =>
        useMarketHomeViewAnalytics(isFocused),
      { initialProps: { isFocused: false } },
    );

    // Deep link from another tab: the first view.
    mockRootState = rootStateOnTab(ETabRoutes.Home);
    markMarketHomeDeeplinkEntry();
    rerender({ isFocused: true });
    expect(mockMarketHomeView).toHaveBeenCalledTimes(1);
    expect(mockMarketHomeView).toHaveBeenLastCalledWith({
      entrySource: EMarketHomeEntrySource.Deeplink,
      isFirstView: true,
    });

    // Switch to another tab, then deep link back: a new entry, like tabBar.
    rerender({ isFocused: false });
    mockRootState = rootStateOnTab(ETabRoutes.Swap);
    markMarketHomeDeeplinkEntry();
    rerender({ isFocused: true });
    expect(mockMarketHomeView).toHaveBeenCalledTimes(2);
    expect(mockMarketHomeView).toHaveBeenLastCalledWith({
      entrySource: EMarketHomeEntrySource.Deeplink,
      isFirstView: false,
    });
  });

  it('does not report a later detail back after a deep link to the focused home', () => {
    mockRootState = rootStateOnTab(ETabRoutes.Market);
    const { rerender } = renderHook(
      ({ isFocused }: { isFocused: boolean }) =>
        useMarketHomeViewAnalytics(isFocused),
      { initialProps: { isFocused: true } },
    );
    expect(mockMarketHomeView).toHaveBeenCalledTimes(1);

    // Deep link while the home is already focused: no focus change.
    markMarketHomeDeeplinkEntry();
    rerender({ isFocused: true });

    // Open a detail and come back within the marker TTL.
    rerender({ isFocused: false });
    markMarketDetailLeft();
    rerender({ isFocused: true });
    expect(mockMarketHomeView).toHaveBeenCalledTimes(1);
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
