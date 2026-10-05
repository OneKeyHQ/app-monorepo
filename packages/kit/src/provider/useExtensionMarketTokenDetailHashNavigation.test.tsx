/** @jest-environment jsdom */
import { act, renderHook } from '@testing-library/react';

import { Dialog, rootNavigationRef } from '@onekeyhq/components';
import {
  ERootRoutes,
  ETabMarketRoutes,
  ETabRoutes,
} from '@onekeyhq/shared/src/routes';
import { readExtensionTokenPreview } from '@onekeyhq/shared/src/utils/marketTokenPreviewRoute';

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
  Dialog: {
    show: jest.fn(() => ({ close: jest.fn().mockResolvedValue(undefined) })),
  },
  rootNavigationRef: {
    current: undefined,
  },
}));

jest.mock('react-intl', () => {
  const intl = { formatMessage: ({ id }: { id: string }) => id };
  return { useIntl: () => intl };
});

jest.mock('@onekeyhq/shared/src/utils/marketTokenPreviewRoute', () => ({
  readExtensionTokenPreview: jest.fn().mockResolvedValue(undefined),
}));

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
    jest
      .mocked(readExtensionTokenPreview)
      .mockReset()
      .mockResolvedValue(undefined);
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
        '#/market/token/bsc/0xabc?isNative=false&from=ExtensionSidePanel&showFavoriteButton=false&disableTrade=true&skipMarketDataFetch=true&marketTokenId=bitcoin&marketVariantId=bitcoin-evm--56-0xabc&marketTokenCategory=top_coins&resolveMarketAsset=true&marketTokenSymbol=BTC',
      ),
    ).toEqual({
      screen: ETabMarketRoutes.MarketDetailV2,
      params: {
        network: 'bsc',
        tokenAddress: '0xabc',
        marketTokenId: 'bitcoin',
        marketVariantId: 'bitcoin-evm--56-0xabc',
        marketTokenCategory: 'top_coins',
        marketTokenSymbol: 'BTC',
        resolveMarketAsset: true,
        skipMarketDataFetch: true,
        isNative: false,
        from: 'ExtensionSidePanel',
        disableTrade: true,
        showFavoriteButton: false,
      },
    });
  });

  it('ignores a serialized token preview in the expand-tab hash', () => {
    const legacyTokenPreview = {
      address: '0xabc',
      networkId: 'evm--1',
      isNative: false,
      name: 'ABC Token',
      symbol: 'ABC',
      decimals: 18,
      price: 1,
      selectedAt: 1,
    };
    const query = new URLSearchParams({
      legacyTokenPreview: JSON.stringify(legacyTokenPreview),
    });

    expect(
      getMarketTokenDetailNavigationTargetFromHash(
        `#/market/token/eth/0xabc?${query.toString()}`,
      ),
    ).toEqual({
      screen: ETabMarketRoutes.MarketDetailV2,
      params: {
        network: 'eth',
        tokenAddress: '0xabc',
      },
    });
  });

  it('restores a trusted session preview before navigating a no-fetch detail', async () => {
    const preview = {
      address: '0xabc',
      networkId: 'evm--1',
      name: 'ABC',
      symbol: 'ABC',
      decimals: 18,
      selectedAt: 1,
    };
    jest.mocked(readExtensionTokenPreview).mockResolvedValue(preview);
    setHash(
      '#/market/token/eth/0xabc?skipMarketDataFetch=true&marketTokenPreviewId=transfer',
    );
    await act(async () => {
      renderHook(() => useExtensionMarketTokenDetailHashNavigation());
    });
    expect(readExtensionTokenPreview).toHaveBeenCalledWith('transfer', {
      network: 'eth',
      tokenAddress: '0xabc',
      isNative: false,
    });
    expect(mockRootNavigationRef.current?.navigate).toHaveBeenCalledWith(
      ERootRoutes.Main,
      {
        screen: ETabRoutes.Market,
        params: {
          screen: ETabMarketRoutes.MarketDetailV2,
          params: {
            network: 'eth',
            tokenAddress: '0xabc',
            skipMarketDataFetch: true,
            marketTokenPreviewId: 'transfer',
            legacyTokenPreview: preview,
          },
        },
      },
    );
  });

  it('adopts a new trusted handoff for the active token only once', async () => {
    const preview = {
      address: '0xabc',
      networkId: 'evm--1',
      name: 'ABC',
      symbol: 'ABC',
      decimals: 18,
      selectedAt: 1,
    };
    jest.mocked(readExtensionTokenPreview).mockResolvedValue(preview);
    mockRootNavigationRef.current?.getCurrentRoute.mockReturnValue({
      name: ETabMarketRoutes.MarketDetailV2,
      params: {
        network: 'eth',
        tokenAddress: '0xabc',
        marketTokenPreviewId: 'old',
        legacyTokenPreview: preview,
      },
    });
    setHash('#/market/token/eth/0xabc?marketTokenPreviewId=new');
    await act(async () => {
      renderHook(() => useExtensionMarketTokenDetailHashNavigation());
    });
    expect(mockRootNavigationRef.current?.navigate).toHaveBeenCalledTimes(1);
    mockRootNavigationRef.current?.getCurrentRoute.mockReturnValue({
      name: ETabMarketRoutes.MarketDetailV2,
      params: {
        network: 'eth',
        tokenAddress: '0xabc',
        marketTokenPreviewId: 'new',
        legacyTokenPreview: preview,
      },
    });
    await act(async () =>
      triggerHashChange(
        '#/market/token/eth/0xabc?marketTokenPreviewId=new&legacyTokenPreview=',
      ),
    );
    expect(mockRootNavigationRef.current?.navigate).toHaveBeenCalledTimes(1);
  });

  it('does not let a slow session lookup navigate after the hash changed', async () => {
    let resolve: (value: undefined) => void = () => undefined;
    jest.mocked(readExtensionTokenPreview).mockReturnValue(
      new Promise((done) => {
        resolve = done;
      }),
    );
    setHash('#/market/token/eth/0xfirst?marketTokenPreviewId=transfer');
    renderHook(() => useExtensionMarketTokenDetailHashNavigation());
    act(() => triggerHashChange('#/market/token/eth/0xsecond'));
    await act(async () => resolve(undefined));
    expect(mockRootNavigationRef.current?.navigate).toHaveBeenCalledTimes(1);
    expect(
      mockRootNavigationRef.current?.navigate.mock.calls[0][1].params.params
        .tokenAddress,
    ).toBe('0xsecond');
  });

  it('clears the previous preview when a new ordinary handoff cannot be read', async () => {
    mockRootNavigationRef.current?.getCurrentRoute.mockReturnValue({
      name: ETabMarketRoutes.MarketDetailV2,
      params: {
        network: 'eth',
        tokenAddress: '0xabc',
        marketTokenPreviewId: 'old',
        legacyTokenPreview: { selectedAt: 1 },
      },
    });
    setHash('#/market/token/eth/0xabc?marketTokenPreviewId=new');
    await act(async () => {
      renderHook(() => useExtensionMarketTokenDetailHashNavigation());
    });
    expect(mockRootNavigationRef.current?.navigate).toHaveBeenCalledTimes(1);
    expect(
      mockRootNavigationRef.current?.navigate.mock.calls[0][1].params.params,
    ).toEqual({
      network: 'eth',
      tokenAddress: '0xabc',
      marketTokenPreviewId: 'new',
      legacyTokenPreview: undefined,
    });
    expect(Dialog.show).not.toHaveBeenCalled();
  });

  it('reports a failed no-fetch handoff and retries without accepting the previous route', async () => {
    mockRootNavigationRef.current?.getCurrentRoute.mockReturnValue({
      name: ETabMarketRoutes.MarketDetailV2,
      params: {
        network: 'eth',
        tokenAddress: '0xabc',
        skipMarketDataFetch: true,
        marketTokenPreviewId: 'old',
        legacyTokenPreview: { selectedAt: 1 },
      },
    });
    setHash(
      '#/market/token/eth/0xabc?skipMarketDataFetch=true&marketTokenPreviewId=new',
    );
    await act(async () => {
      renderHook(() => useExtensionMarketTokenDetailHashNavigation());
    });
    expect(mockRootNavigationRef.current?.navigate).not.toHaveBeenCalled();
    expect(Dialog.show).toHaveBeenCalledTimes(1);
    const preview = {
      address: '0xabc',
      networkId: 'evm--1',
      name: 'ABC',
      symbol: 'ABC',
      decimals: 18,
      selectedAt: 2,
    };
    jest.mocked(readExtensionTokenPreview).mockResolvedValue(preview);
    const retry = jest.mocked(Dialog.show).mock.calls[0][0].onConfirm;
    await act(async () => {
      await retry?.({
        close: jest.fn().mockResolvedValue(undefined),
        getForm: jest.fn(),
        isExist: jest.fn(),
        preventClose: jest.fn(),
      });
    });
    expect(mockRootNavigationRef.current?.navigate).toHaveBeenCalledTimes(1);
    expect(
      mockRootNavigationRef.current?.navigate.mock.calls[0][1].params.params
        .legacyTokenPreview,
    ).toEqual(preview);
  });

  it('does not retry an error dialog after the user navigates to another token', async () => {
    setHash(
      '#/market/token/eth/0xabc?skipMarketDataFetch=true&marketTokenPreviewId=failed',
    );
    await act(async () => {
      renderHook(() => useExtensionMarketTokenDetailHashNavigation());
    });
    const retry = jest.mocked(Dialog.show).mock.calls[0][0].onConfirm;
    await act(async () => {
      triggerHashChange('#/market/token/eth/0xother');
    });
    const reads = jest.mocked(readExtensionTokenPreview).mock.calls.length;
    await act(async () => {
      await retry?.({
        close: jest.fn().mockResolvedValue(undefined),
        getForm: jest.fn(),
        isExist: jest.fn(),
        preventClose: jest.fn(),
      });
    });
    expect(readExtensionTokenPreview).toHaveBeenCalledTimes(reads);
    expect(mockRootNavigationRef.current?.navigate).toHaveBeenCalledTimes(1);
    expect(
      mockRootNavigationRef.current?.navigate.mock.calls[0][1].params.params
        .tokenAddress,
    ).toBe('0xother');
  });

  it('ignores a malformed serialized token preview', () => {
    expect(
      getMarketTokenDetailNavigationTargetFromHash(
        '#/market/token/eth/0xabc?legacyTokenPreview=%7B%22name%22%3A1%7D',
      ),
    ).toEqual({
      screen: ETabMarketRoutes.MarketDetailV2,
      params: {
        network: 'eth',
        tokenAddress: '0xabc',
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

  it('reads a native handoff with the identity encoded by the producer', async () => {
    const preview = {
      address: '',
      networkId: 'evm--1',
      isNative: true,
      name: 'Ether',
      symbol: 'ETH',
      decimals: 18,
      selectedAt: 1,
    };
    jest.mocked(readExtensionTokenPreview).mockResolvedValue(preview);
    setHash(
      '#/market/token/eth/?isNative=true&marketTokenPreviewId=native&skipMarketDataFetch=true',
    );
    await act(async () => {
      renderHook(() => useExtensionMarketTokenDetailHashNavigation());
    });
    expect(readExtensionTokenPreview).toHaveBeenCalledWith('native', {
      network: 'eth',
      tokenAddress: '',
      isNative: true,
    });
    expect(
      mockRootNavigationRef.current?.navigate.mock.calls[0][1].params,
    ).toEqual({
      screen: ETabMarketRoutes.MarketNativeDetail,
      params: expect.objectContaining({
        legacyTokenPreview: preview,
        isNative: true,
      }),
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

  it.each(['', '?legacyTokenPreview=%5Bobject%20Object%5D'])(
    'does not navigate again when the active preview is absent from the hash: %s',
    (query) => {
      setHash(`#/market/token/eth/0xabc${query}`);
      mockRootNavigationRef.current?.getCurrentRoute.mockReturnValue({
        name: ETabMarketRoutes.MarketDetailV2,
        params: {
          network: 'eth',
          tokenAddress: '0xabc',
          legacyTokenPreview: { selectedAt: 1 },
        },
      });
      renderHook(() => useExtensionMarketTokenDetailHashNavigation());
      act(() => jest.runOnlyPendingTimers());
      expect(mockRootNavigationRef.current?.navigate).not.toHaveBeenCalled();
    },
  );

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
    {
      query: 'resolveMarketAsset=true',
      currentParams: {},
      expectedParams: { resolveMarketAsset: true },
    },
    {
      query: 'marketTokenSymbol=BTC',
      currentParams: {},
      expectedParams: { marketTokenSymbol: 'BTC' },
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
