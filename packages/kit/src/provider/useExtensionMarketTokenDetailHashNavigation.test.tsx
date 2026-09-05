/** @jest-environment jsdom */
import { act, renderHook } from '@testing-library/react';

import { rootNavigationRef } from '@onekeyhq/components';
import {
  ERootRoutes,
  ETabMarketRoutes,
  ETabRoutes,
} from '@onekeyhq/shared/src/routes';

import { prefetchMarketDetailV2FirstScreenKLine } from '../views/Market/MarketDetailV2/utils/marketDetailPagePreload';

import {
  getMarketTokenDetailNavigationTargetFromHash,
  useExtensionMarketTokenDetailHashNavigation,
} from './useExtensionMarketTokenDetailHashNavigation';

jest.mock('@onekeyhq/shared/src/platformEnv', () => ({
  __esModule: true,
  default: {
    isExtensionUiExpandTab: true,
  },
}));

jest.mock('@onekeyhq/components', () => ({
  rootNavigationRef: {
    current: undefined,
  },
}));

jest.mock(
  '../views/Market/MarketDetailV2/utils/marketDetailPagePreload',
  () => ({
    prefetchMarketDetailV2FirstScreenKLine: jest.fn(() => Promise.resolve()),
  }),
);

const mockRootNavigationRef = rootNavigationRef as unknown as {
  current:
    | {
        navigate: jest.Mock;
        getCurrentRoute: jest.Mock;
      }
    | undefined;
};

let hashChangeHandler: (() => void) | undefined;
let originalAddEventListener: typeof globalThis.addEventListener | undefined;
let originalRemoveEventListener:
  | typeof globalThis.removeEventListener
  | undefined;

function setHash(hash: string) {
  globalThis.history.replaceState(null, '', hash);
}

function triggerHashChange(hash: string) {
  setHash(hash);
  hashChangeHandler?.();
}

describe('useExtensionMarketTokenDetailHashNavigation', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.clearAllMocks();
    hashChangeHandler = undefined;
    originalAddEventListener = globalThis.addEventListener;
    originalRemoveEventListener = globalThis.removeEventListener;
    Object.defineProperty(globalThis, 'addEventListener', {
      configurable: true,
      value: jest.fn(
        (type: string, listener: EventListenerOrEventListenerObject | null) => {
          if (type === 'hashchange' && typeof listener === 'function') {
            const eventListener: EventListener = listener;
            hashChangeHandler = () => {
              eventListener(new HashChangeEvent('hashchange'));
            };
          }
        },
      ),
    });
    Object.defineProperty(globalThis, 'removeEventListener', {
      configurable: true,
      value: jest.fn((type: string) => {
        if (type === 'hashchange') {
          hashChangeHandler = undefined;
        }
      }),
    });
    setHash('#/');
    mockRootNavigationRef.current = {
      navigate: jest.fn(),
      getCurrentRoute: jest.fn(),
    };
  });

  afterEach(() => {
    act(() => {
      jest.runOnlyPendingTimers();
    });
    Object.defineProperty(globalThis, 'addEventListener', {
      configurable: true,
      value: originalAddEventListener,
    });
    Object.defineProperty(globalThis, 'removeEventListener', {
      configurable: true,
      value: originalRemoveEventListener,
    });
    jest.useRealTimers();
  });

  it('parses market token detail hash', () => {
    expect(
      getMarketTokenDetailNavigationTargetFromHash(
        '#/market/token/bsc/0xabc?isNative=false&chartMode=tradingView&from=ExtensionSidePanel&showFavoriteButton=false&disableTrade=true&skipMarketDataFetch=true&marketTokenId=bitcoin&marketVariantId=bitcoin-evm--56-0xabc&marketTokenCategory=top_coins',
      ),
    ).toEqual({
      screen: ETabMarketRoutes.MarketDetailV2,
      params: {
        network: 'bsc',
        tokenAddress: '0xabc',
        marketTokenId: 'bitcoin',
        marketVariantId: 'bitcoin-evm--56-0xabc',
        marketTokenCategory: 'top_coins',
        skipMarketDataFetch: true,
        isNative: false,
        chartMode: 'tradingView',
        from: 'ExtensionSidePanel',
        disableTrade: true,
        showFavoriteButton: false,
      },
    });
  });

  it('parses native market detail hash', () => {
    expect(
      getMarketTokenDetailNavigationTargetFromHash(
        '#/market/token/btc--0/?isNative=true&disableTrade=true&skipMarketDataFetch=true&marketTokenId=bitcoin&marketTokenCategory=top_coins',
      ),
    ).toEqual({
      screen: ETabMarketRoutes.MarketNativeDetail,
      params: {
        network: 'btc--0',
        isNative: true,
        marketTokenId: 'bitcoin',
        marketTokenCategory: 'top_coins',
        skipMarketDataFetch: true,
        disableTrade: true,
      },
    });
  });

  it('parses market stock detail hash with an optional token variant', () => {
    expect(
      getMarketTokenDetailNavigationTargetFromHash(
        '#/market/stock/AAPL?network=eth&tokenAddress=0xaapl&from=ExtensionPopup&disableTrade=true&showFavoriteButton=false',
      ),
    ).toEqual({
      screen: ETabMarketRoutes.MarketStockDetail,
      params: {
        stockId: 'AAPL',
        network: 'eth',
        tokenAddress: '0xaapl',
        from: 'ExtensionPopup',
        disableTrade: true,
        showFavoriteButton: false,
      },
    });
  });

  it('parses the stock preview from an extension detail hash', () => {
    expect(
      getMarketTokenDetailNavigationTargetFromHash(
        '#/market/stock/AAPL?stockPreviewSymbol=AAPL&stockPreviewName=Apple+Inc.&stockPreviewLogoUrl=https%3A%2F%2Fexample.com%2Faapl.png',
      ),
    ).toEqual({
      screen: ETabMarketRoutes.MarketStockDetail,
      params: {
        stockId: 'AAPL',
        stockPreviewSymbol: 'AAPL',
        stockPreviewName: 'Apple Inc.',
        stockPreviewLogoUrl: 'https://example.com/aapl.png',
      },
    });
  });

  it('preserves native token address when the hash includes one', () => {
    expect(
      getMarketTokenDetailNavigationTargetFromHash(
        '#/market/token/btc--0/0xnative?isNative=true&from=ExtensionSidePanel',
      ),
    ).toEqual({
      screen: ETabMarketRoutes.MarketDetailV2,
      params: {
        network: 'btc--0',
        tokenAddress: '0xnative',
        isNative: true,
        from: 'ExtensionSidePanel',
      },
    });
  });

  it('ignores unrelated or malformed hash', () => {
    expect(getMarketTokenDetailNavigationTargetFromHash('#/')).toBeUndefined();
    expect(
      getMarketTokenDetailNavigationTargetFromHash(
        '#/market/token/%E0%A4%A/0xabc',
      ),
    ).toBeUndefined();
  });

  it('navigates to market detail from current hash on mount', () => {
    setHash('#/market/token/eth/0xabc?isNative=false');

    renderHook(() => useExtensionMarketTokenDetailHashNavigation());

    expect(mockRootNavigationRef.current?.navigate).toHaveBeenCalledWith(
      ERootRoutes.Main,
      {
        screen: ETabRoutes.Market,
        params: {
          screen: ETabMarketRoutes.MarketDetailV2,
          params: {
            network: 'eth',
            tokenAddress: '0xabc',
            isNative: false,
          },
        },
      },
    );
    expect(prefetchMarketDetailV2FirstScreenKLine).not.toHaveBeenCalled();
  });

  it('prefetches only for an explicit TradingView hash target', () => {
    setHash('#/market/token/eth/0xabc?isNative=false&chartMode=tradingView');

    renderHook(() => useExtensionMarketTokenDetailHashNavigation());

    expect(prefetchMarketDetailV2FirstScreenKLine).toHaveBeenCalledWith(
      expect.objectContaining({ tokenAddress: '0xabc' }),
    );
  });

  it('navigates to stock detail from current hash on mount', () => {
    setHash('#/market/stock/AAPL');

    renderHook(() => useExtensionMarketTokenDetailHashNavigation());

    expect(mockRootNavigationRef.current?.navigate).toHaveBeenCalledWith(
      ERootRoutes.Main,
      {
        screen: ETabRoutes.Market,
        params: {
          screen: ETabMarketRoutes.MarketStockDetail,
          params: {
            stockId: 'AAPL',
          },
        },
      },
    );
  });

  it('retries the same hash for a short window only', () => {
    setHash('#/market/token/eth/0xabc');
    renderHook(() => useExtensionMarketTokenDetailHashNavigation());

    expect(mockRootNavigationRef.current?.navigate).toHaveBeenCalledTimes(1);
    act(() => {
      jest.advanceTimersByTime(120);
    });
    expect(mockRootNavigationRef.current?.navigate).toHaveBeenCalledTimes(2);

    act(() => {
      jest.advanceTimersByTime(360);
    });
    expect(mockRootNavigationRef.current?.navigate).toHaveBeenCalledTimes(3);

    mockRootNavigationRef.current?.getCurrentRoute.mockReturnValue({
      name: ETabRoutes.Home,
    });
    act(() => {
      jest.advanceTimersByTime(1000);
    });
    expect(mockRootNavigationRef.current?.navigate).toHaveBeenCalledTimes(3);
  });

  it('stops retrying once the target detail route is active', () => {
    setHash('#/market/token/eth/0xabc');
    renderHook(() => useExtensionMarketTokenDetailHashNavigation());
    expect(mockRootNavigationRef.current?.navigate).toHaveBeenCalledTimes(1);

    mockRootNavigationRef.current?.getCurrentRoute.mockReturnValue({
      name: ETabMarketRoutes.MarketDetailV2,
      params: {
        network: 'eth',
        tokenAddress: '0xabc',
      },
    });
    act(() => {
      jest.advanceTimersByTime(120);
    });
    act(() => {
      jest.advanceTimersByTime(1000);
    });

    expect(mockRootNavigationRef.current?.navigate).toHaveBeenCalledTimes(1);
  });

  it('refreshes the same token route when favorite visibility changes', () => {
    setHash('#/market/token/eth/0xabc?showFavoriteButton=false');
    mockRootNavigationRef.current?.getCurrentRoute.mockReturnValue({
      name: ETabMarketRoutes.MarketDetailV2,
      params: {
        network: 'eth',
        tokenAddress: '0xabc',
        showFavoriteButton: true,
      },
    });

    renderHook(() => useExtensionMarketTokenDetailHashNavigation());

    expect(mockRootNavigationRef.current?.navigate).toHaveBeenCalledWith(
      ERootRoutes.Main,
      {
        screen: ETabRoutes.Market,
        params: {
          screen: ETabMarketRoutes.MarketDetailV2,
          params: {
            network: 'eth',
            tokenAddress: '0xabc',
            showFavoriteButton: false,
          },
        },
      },
    );
  });

  it('refreshes the same stock route when preview metadata changes', () => {
    setHash(
      '#/market/stock/AAPL?stockPreviewSymbol=AAPL&stockPreviewName=Apple+Inc.&stockPreviewLogoUrl=https%3A%2F%2Fexample.com%2Fnew.png',
    );
    mockRootNavigationRef.current?.getCurrentRoute.mockReturnValue({
      name: ETabMarketRoutes.MarketStockDetail,
      params: {
        stockId: 'AAPL',
        stockPreviewSymbol: 'AAPL',
        stockPreviewName: 'Apple Inc.',
        stockPreviewLogoUrl: 'https://example.com/old.png',
      },
    });

    renderHook(() => useExtensionMarketTokenDetailHashNavigation());

    expect(mockRootNavigationRef.current?.navigate).toHaveBeenCalledWith(
      ERootRoutes.Main,
      {
        screen: ETabRoutes.Market,
        params: {
          screen: ETabMarketRoutes.MarketStockDetail,
          params: {
            stockId: 'AAPL',
            stockPreviewSymbol: 'AAPL',
            stockPreviewName: 'Apple Inc.',
            stockPreviewLogoUrl: 'https://example.com/new.png',
          },
        },
      },
    );
  });

  it.each([
    {
      query: 'disableTrade=true',
      currentParams: { disableTrade: false },
      expectedParams: { disableTrade: true },
    },
    {
      query: 'skipMarketDataFetch=true',
      currentParams: { skipMarketDataFetch: false },
      expectedParams: { skipMarketDataFetch: true },
    },
    {
      query: 'marketTokenId=bitcoin',
      currentParams: {},
      expectedParams: { marketTokenId: 'bitcoin' },
    },
    {
      query: 'marketVariantId=bitcoin-evm--1-0xabc',
      currentParams: {},
      expectedParams: { marketVariantId: 'bitcoin-evm--1-0xabc' },
    },
    {
      query: 'marketTokenCategory=top_coins',
      currentParams: {},
      expectedParams: { marketTokenCategory: 'top_coins' },
    },
  ])(
    'refreshes the same token route when $query changes',
    ({ query, currentParams, expectedParams }) => {
      setHash(`#/market/token/eth/0xabc?${query}`);
      mockRootNavigationRef.current?.getCurrentRoute.mockReturnValue({
        name: ETabMarketRoutes.MarketDetailV2,
        params: {
          network: 'eth',
          tokenAddress: '0xabc',
          ...currentParams,
        },
      });

      renderHook(() => useExtensionMarketTokenDetailHashNavigation());

      expect(mockRootNavigationRef.current?.navigate).toHaveBeenCalledWith(
        ERootRoutes.Main,
        {
          screen: ETabRoutes.Market,
          params: {
            screen: ETabMarketRoutes.MarketDetailV2,
            params: {
              network: 'eth',
              tokenAddress: '0xabc',
              ...expectedParams,
            },
          },
        },
      );
    },
  );

  it('restores default favorite visibility when reopening the same token from Market', () => {
    setHash('#/market/token/eth/0xabc');
    mockRootNavigationRef.current?.getCurrentRoute.mockReturnValue({
      name: ETabMarketRoutes.MarketDetailV2,
      params: {
        network: 'eth',
        tokenAddress: '0xabc',
        showFavoriteButton: false,
      },
    });

    renderHook(() => useExtensionMarketTokenDetailHashNavigation());

    expect(mockRootNavigationRef.current?.navigate).toHaveBeenCalledWith(
      ERootRoutes.Main,
      {
        screen: ETabRoutes.Market,
        params: {
          screen: ETabMarketRoutes.MarketDetailV2,
          params: {
            network: 'eth',
            tokenAddress: '0xabc',
          },
        },
      },
    );
  });

  it('starts a new navigation run on hash change', () => {
    setHash('#/market/token/eth/0xabc');
    renderHook(() => useExtensionMarketTokenDetailHashNavigation());
    expect(mockRootNavigationRef.current?.navigate).toHaveBeenCalledTimes(1);

    act(() => {
      triggerHashChange('#/market/token/bsc/0xdef');
    });

    expect(mockRootNavigationRef.current?.navigate).toHaveBeenCalledTimes(2);
    expect(mockRootNavigationRef.current?.navigate).toHaveBeenLastCalledWith(
      ERootRoutes.Main,
      {
        screen: ETabRoutes.Market,
        params: {
          screen: ETabMarketRoutes.MarketDetailV2,
          params: {
            network: 'bsc',
            tokenAddress: '0xdef',
          },
        },
      },
    );
  });

  it('navigates again after leaving and reopening the same token hash', () => {
    setHash('#/market/token/eth/0xabc');
    renderHook(() => useExtensionMarketTokenDetailHashNavigation());

    mockRootNavigationRef.current?.getCurrentRoute.mockReturnValue({
      name: ETabMarketRoutes.MarketDetailV2,
      params: {
        network: 'eth',
        tokenAddress: '0xabc',
      },
    });
    act(() => {
      jest.advanceTimersByTime(120);
    });

    act(() => {
      triggerHashChange('#/');
    });

    mockRootNavigationRef.current?.getCurrentRoute.mockReturnValue({
      name: ETabRoutes.Home,
    });
    act(() => {
      triggerHashChange('#/market/token/eth/0xabc');
    });

    expect(mockRootNavigationRef.current?.navigate).toHaveBeenCalledTimes(2);
    expect(mockRootNavigationRef.current?.navigate).toHaveBeenLastCalledWith(
      ERootRoutes.Main,
      {
        screen: ETabRoutes.Market,
        params: {
          screen: ETabMarketRoutes.MarketDetailV2,
          params: {
            network: 'eth',
            tokenAddress: '0xabc',
          },
        },
      },
    );
  });

  it('retries when navigation becomes ready during the retry window', () => {
    setHash('#/market/token/eth/0xabc');
    mockRootNavigationRef.current = undefined;

    renderHook(() => useExtensionMarketTokenDetailHashNavigation());

    expect(mockRootNavigationRef.current).toBeUndefined();

    mockRootNavigationRef.current = {
      navigate: jest.fn(),
      getCurrentRoute: jest.fn(),
    };
    act(() => {
      jest.advanceTimersByTime(120);
    });

    expect(mockRootNavigationRef.current.navigate).toHaveBeenCalledWith(
      ERootRoutes.Main,
      {
        screen: ETabRoutes.Market,
        params: {
          screen: ETabMarketRoutes.MarketDetailV2,
          params: {
            network: 'eth',
            tokenAddress: '0xabc',
          },
        },
      },
    );
  });
});
