/** @jest-environment jsdom */
import type { PropsWithChildren } from 'react';

import { act, renderHook, waitFor } from '@testing-library/react';

import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import {
  swrCacheUtils,
  swrKeys,
} from '@onekeyhq/shared/src/utils/swrCacheUtils';
import type {
  IMarketStockPublicDetail,
  IMarketStockTokenVariant,
  IMarketStockTokenVariantsResponse,
} from '@onekeyhq/shared/types/marketV2';

import { StockDetailProvider, useStockDetail } from './StockDetailContext';

jest.mock('@onekeyhq/components', () => {
  // usePromiseResult parks the pending polling tick on this deferred promise
  // while the route is blurred, so the focus tests below need the real
  // implementation instead of an always-resolved stub.
  const deferredPromiseModule =
    // eslint-disable-next-line global-require, import/no-relative-packages, @typescript-eslint/no-var-requires
    require('../../../../../../components/src/hooks/useDeferredPromise') as typeof import('@onekeyhq/components');
  return {
    getCurrentVisibilityState: () => true,
    onVisibilityStateChange: () => () => undefined,
    useDeferredPromise: deferredPromiseModule.useDeferredPromise,
    useNetInfo: () => ({ isRawInternetReachable: true }),
  };
});

jest.mock('@onekeyhq/kit/src/background/instance/backgroundApiProxy', () => ({
  __esModule: true,
  default: {
    serviceMarketV2: {
      fetchMarketStockDetail: jest.fn(),
      fetchMarketStockTokenVariants: jest.fn(),
    },
  },
}));

jest.mock('@onekeyhq/kit/src/hooks/useLocaleVariant', () => ({
  useLocaleVariant: () => 'en-US',
}));

jest.mock('@onekeyhq/kit/src/hooks/useRouteIsFocused', () => {
  // eslint-disable-next-line global-require, @typescript-eslint/no-var-requires
  const ReactModule = require('react') as typeof import('react');
  let currentFocus = true;
  const listeners: Array<(value: boolean) => void> = [];

  const __setFocus = (value: boolean) => {
    if (currentFocus === value) return;
    currentFocus = value;
    listeners.slice().forEach((listener) => listener(value));
  };
  const __resetFocus = () => {
    currentFocus = true;
    listeners.slice().forEach((listener) => listener(true));
  };

  const useRouteIsFocused = () => {
    const [value, setValue] = ReactModule.useState<boolean>(currentFocus);
    ReactModule.useEffect(() => {
      listeners.push(setValue);
      setValue(currentFocus);
      return () => {
        const index = listeners.indexOf(setValue);
        if (index >= 0) listeners.splice(index, 1);
      };
    }, []);
    return value;
  };

  return { useRouteIsFocused, __setFocus, __resetFocus };
});

const focusControl = jest.requireMock(
  '@onekeyhq/kit/src/hooks/useRouteIsFocused',
) as {
  __setFocus: (value: boolean) => void;
  __resetFocus: () => void;
};

// Mirrors STOCK_DETAIL_POLLING_INTERVAL in StockDetailContext.tsx.
const STOCK_DETAIL_POLLING_MS = 15 * 1000;
// Mirrors STOCK_TOKEN_VARIANTS_POLLING_INTERVAL in StockDetailContext.tsx.
const STOCK_TOKEN_VARIANTS_POLLING_MS = 6000;

function createDeferred<T>() {
  let resolve: (value: T) => void = () => undefined;
  const promise = new Promise<T>((promiseResolve) => {
    resolve = promiseResolve;
  });
  return { promise, resolve };
}

// usePromiseResult defers its very first run through a setTimeout, so awaiting
// microtasks alone would observe a not-yet-started request and report success
// no matter how the focus gate is configured.
const flushTaskQueues = () =>
  act(async () => {
    await new Promise((resolve) => {
      setTimeout(resolve, 0);
    });
  });

describe('StockDetailProvider', () => {
  const serviceMarketV2 = backgroundApiProxy.serviceMarketV2 as jest.Mocked<
    typeof backgroundApiProxy.serviceMarketV2
  >;

  beforeEach(() => {
    jest.clearAllMocks();
    focusControl.__resetFocus();
    // Stock resources are cached per stock; keep each case on a cold start.
    swrCacheUtils.clearAll();
  });

  it('exposes a matching route preview before the stock detail request settles', () => {
    const stockPreview = {
      stockId: 'AAPL',
      symbol: 'AAPL',
      name: 'Apple Inc.',
      logoUrl: 'https://example.com/aapl.png',
    };
    const wrapper = ({ children }: PropsWithChildren) => (
      <StockDetailProvider stockId="aapl" initialStockPreview={stockPreview}>
        {children}
      </StockDetailProvider>
    );

    const { result } = renderHook(() => useStockDetail(), { wrapper });

    expect(result.current.stockDetail).toBeUndefined();
    expect(result.current.stockPreview).toEqual(stockPreview);
  });

  it('ignores a route preview that belongs to another stock', () => {
    const wrapper = ({ children }: PropsWithChildren) => (
      <StockDetailProvider
        stockId="MSFT"
        initialStockPreview={{
          stockId: 'AAPL',
          symbol: 'AAPL',
          name: 'Apple Inc.',
          logoUrl: 'https://example.com/aapl.png',
        }}
      >
        {children}
      </StockDetailProvider>
    );

    const { result } = renderHook(() => useStockDetail(), { wrapper });

    expect(result.current.stockPreview).toBeUndefined();
  });

  it('loads stock resources by stockId and selects the backend default token', async () => {
    serviceMarketV2.fetchMarketStockDetail.mockResolvedValue({
      stockId: 'AAPL',
      symbol: 'AAPL',
      name: 'Apple Inc.',
      logoUrl: '',
      assetType: 'stock',
      peRatio: '31.46',
      currency: 'USD',
      categories: [],
      aliases: [],
    });
    serviceMarketV2.fetchMarketStockTokenVariants.mockResolvedValue({
      stockId: 'AAPL',
      defaultTokenId: 'aapl-ondo',
      items: [
        {
          tokenId: 'aapl-xstock',
          issuer: 'xstock',
          networkId: 'sol--101',
          contractAddress: 'AAPLx',
          currency: 'USD',
          status: 'active',
          tradingEnabled: true,
        },
        {
          tokenId: 'aapl-ondo',
          issuer: 'ondo',
          networkId: 'evm--1',
          contractAddress: '0xaapl',
          currency: 'USD',
          status: 'active',
          tradingEnabled: true,
        },
      ],
    });

    const wrapper = ({ children }: PropsWithChildren) => (
      <StockDetailProvider stockId="aapl">{children}</StockDetailProvider>
    );
    const { result } = renderHook(() => useStockDetail(), { wrapper });

    await waitFor(() => {
      expect(result.current.stockDetail?.stockId).toBe('AAPL');
      expect(result.current.selectedTokenVariant?.tokenId).toBe('aapl-ondo');
      expect(result.current.portfolioNetworkId).toBe('evm--1');
    });

    act(() => {
      result.current.setSelectedTokenId('aapl-xstock');
    });

    expect(result.current.selectedTokenVariant?.tokenId).toBe('aapl-xstock');
    expect(result.current.portfolioNetworkId).toBe('sol--101');

    expect(serviceMarketV2.fetchMarketStockDetail.mock.calls).toEqual([
      [{ stockId: 'AAPL' }],
    ]);
    expect(serviceMarketV2.fetchMarketStockTokenVariants.mock.calls).toEqual([
      [{ stockId: 'AAPL' }],
    ]);
  });

  it('settles a missing preserved token without falling back or waiting forever', async () => {
    const request = createDeferred<IMarketStockTokenVariantsResponse>();
    serviceMarketV2.fetchMarketStockTokenVariants.mockReturnValue(
      request.promise,
    );
    const wrapper = ({ children }: PropsWithChildren) => (
      <StockDetailProvider
        stockId="AAPL"
        preserveInitialToken
        initialNetworkId="evm--1"
        initialTokenAddress="0xselected"
      >
        {children}
      </StockDetailProvider>
    );
    const { result } = renderHook(() => useStockDetail(), { wrapper });
    expect(result.current.isTokenVariantPending).toBe(true);
    await act(async () =>
      request.resolve({
        stockId: 'AAPL',
        defaultTokenId: 'another-token',
        items: [
          {
            tokenId: 'another-token',
            issuer: 'ondo',
            networkId: 'evm--1',
            contractAddress: '0xother',
            currency: 'USD',
            status: 'active',
            tradingEnabled: true,
          },
        ],
      }),
    );
    await waitFor(() =>
      expect(result.current.isTokenVariantPending).toBe(false),
    );
    expect(result.current.tokenVariants).toHaveLength(1);
    expect(result.current.selectedTokenVariant).toBeUndefined();
    expect(result.current.selectedTokenId).toBeUndefined();
  });

  it('selects a cached variant on the first render of a revisit', () => {
    serviceMarketV2.fetchMarketStockTokenVariants.mockReturnValue(
      new Promise(() => undefined),
    );
    serviceMarketV2.fetchMarketStockDetail.mockReturnValue(
      new Promise(() => undefined),
    );
    swrCacheUtils.set(
      swrKeys.marketStockTokenVariants({ stockId: 'AAPL', locale: 'en-us' }),
      {
        stockId: 'AAPL',
        defaultTokenId: 'aapl-ondo',
        items: [
          {
            tokenId: 'aapl-ondo',
            issuer: 'ondo',
            networkId: 'evm--56',
            contractAddress: '0xondo',
            currency: 'USD',
            status: 'active',
            tradingEnabled: true,
          },
        ],
      },
    );
    const wrapper = ({ children }: PropsWithChildren) => (
      <StockDetailProvider stockId="AAPL">{children}</StockDetailProvider>
    );
    const { result } = renderHook(() => useStockDetail(), { wrapper });

    // The token identity is known before any request settles.
    expect(result.current.isTokenVariantPending).toBe(false);
    expect(result.current.selectedTokenVariant?.tokenId).toBe('aapl-ondo');
  });

  it('keeps a stale cached list pending until the preserved route variant resolves', async () => {
    const request = createDeferred<IMarketStockTokenVariantsResponse>();
    const routeVariant: IMarketStockTokenVariant = {
      tokenId: 'aapl-backed',
      issuer: 'backed',
      networkId: 'evm--1',
      contractAddress: '0xbacked',
      currency: 'USD',
      status: 'active',
      tradingEnabled: true,
    };
    serviceMarketV2.fetchMarketStockTokenVariants.mockReturnValue(
      request.promise,
    );
    swrCacheUtils.set(
      swrKeys.marketStockTokenVariants({ stockId: 'AAPL', locale: 'en-us' }),
      {
        stockId: 'AAPL',
        defaultTokenId: 'aapl-ondo',
        items: [
          {
            tokenId: 'aapl-ondo',
            issuer: 'ondo',
            networkId: 'evm--56',
            contractAddress: '0xondo',
            currency: 'USD',
            status: 'active',
            tradingEnabled: true,
          },
        ],
      },
    );
    const wrapper = ({ children }: PropsWithChildren) => (
      <StockDetailProvider
        stockId="AAPL"
        preserveInitialToken
        initialNetworkId={routeVariant.networkId}
        initialTokenAddress={routeVariant.contractAddress}
      >
        {children}
      </StockDetailProvider>
    );
    const { result } = renderHook(() => useStockDetail(), { wrapper });

    expect(result.current.isTokenVariantPending).toBe(true);
    expect(result.current.selectedTokenVariant).toBeUndefined();

    await act(async () =>
      request.resolve({
        stockId: 'AAPL',
        defaultTokenId: routeVariant.tokenId,
        items: [routeVariant],
      }),
    );
    await waitFor(() =>
      expect(result.current.selectedTokenVariant?.tokenId).toBe(
        routeVariant.tokenId,
      ),
    );
    expect(result.current.isTokenVariantPending).toBe(false);
  });

  it('does not re-enter pending while polling a settled stale variant list', async () => {
    jest.useFakeTimers();
    const staleVariant: IMarketStockTokenVariant = {
      tokenId: 'aapl-ondo',
      issuer: 'ondo',
      networkId: 'evm--56',
      contractAddress: '0xondo',
      currency: 'USD',
      status: 'active',
      tradingEnabled: true,
    };
    const staleResponse: IMarketStockTokenVariantsResponse = {
      stockId: 'AAPL',
      defaultTokenId: staleVariant.tokenId,
      items: [staleVariant],
    };
    const pollingRequest = createDeferred<IMarketStockTokenVariantsResponse>();
    serviceMarketV2.fetchMarketStockTokenVariants
      .mockResolvedValueOnce(staleResponse)
      .mockReturnValueOnce(pollingRequest.promise);

    try {
      swrCacheUtils.set(
        swrKeys.marketStockTokenVariants({
          stockId: 'AAPL',
          locale: 'en-us',
        }),
        staleResponse,
      );
      const wrapper = ({ children }: PropsWithChildren) => (
        <StockDetailProvider
          stockId="AAPL"
          preserveInitialToken
          initialNetworkId="evm--1"
          initialTokenAddress="0xselected"
        >
          {children}
        </StockDetailProvider>
      );
      const { result, unmount } = renderHook(() => useStockDetail(), {
        wrapper,
      });

      await act(async () => {
        await jest.advanceTimersByTimeAsync(0);
      });
      expect(result.current.selectedTokenVariant).toBeUndefined();
      expect(result.current.isTokenVariantPending).toBe(false);

      await act(async () => {
        await jest.advanceTimersByTimeAsync(STOCK_TOKEN_VARIANTS_POLLING_MS);
      });
      expect(
        serviceMarketV2.fetchMarketStockTokenVariants.mock.calls,
      ).toHaveLength(2);
      expect(result.current.isTokenVariantPending).toBe(false);

      unmount();
      pollingRequest.resolve(staleResponse);
    } finally {
      jest.useRealTimers();
    }
  });

  // PR 13609 review: a cached list can predate the route's variant. Resolving
  // against it must not retire the route, or the fetched list that finally
  // carries that variant is skipped and the page trades the wrong token.
  it('applies the route variant from the fetched list when the cache lacked it', async () => {
    const routeVariant: IMarketStockTokenVariant = {
      tokenId: 'aapl-backed',
      issuer: 'backed',
      networkId: 'evm--1',
      contractAddress: '0xbacked',
      currency: 'USD',
      status: 'active',
      tradingEnabled: true,
    };
    const defaultVariant: IMarketStockTokenVariant = {
      tokenId: 'aapl-ondo',
      issuer: 'ondo',
      networkId: 'evm--56',
      contractAddress: '0xondo',
      currency: 'USD',
      status: 'active',
      tradingEnabled: true,
    };
    // The snapshot only knows the default issuer.
    swrCacheUtils.set(
      swrKeys.marketStockTokenVariants({ stockId: 'AAPL', locale: 'en-us' }),
      {
        stockId: 'AAPL',
        defaultTokenId: 'aapl-ondo',
        items: [defaultVariant],
      },
    );
    serviceMarketV2.fetchMarketStockDetail.mockReturnValue(
      new Promise(() => undefined),
    );
    serviceMarketV2.fetchMarketStockTokenVariants.mockResolvedValue({
      stockId: 'AAPL',
      defaultTokenId: 'aapl-ondo',
      items: [defaultVariant, routeVariant],
    });

    const wrapper = ({ children }: PropsWithChildren) => (
      <StockDetailProvider
        stockId="AAPL"
        initialNetworkId="evm--1"
        initialTokenAddress="0xbacked"
      >
        {children}
      </StockDetailProvider>
    );
    const { result } = renderHook(() => useStockDetail(), { wrapper });

    // First frame renders the only token the cache knew about.
    expect(result.current.selectedTokenVariant?.tokenId).toBe('aapl-ondo');

    await waitFor(() =>
      expect(result.current.selectedTokenVariant?.tokenId).toBe('aapl-backed'),
    );
  });

  // PR 13609 review: on a revisit usePromiseResult replays the cached payload,
  // but the per-stock fallbacks used to start empty, so the first failed
  // request replaced what the page was already showing with an error.
  it('keeps the hydrated detail and variants when the first request fails', async () => {
    const variant: IMarketStockTokenVariant = {
      tokenId: 'aapl-ondo',
      issuer: 'ondo',
      networkId: 'evm--56',
      contractAddress: '0xondo',
      currency: 'USD',
      status: 'active',
      tradingEnabled: true,
    };
    swrCacheUtils.set(
      swrKeys.marketStockTokenVariants({ stockId: 'AAPL', locale: 'en-us' }),
      { stockId: 'AAPL', defaultTokenId: 'aapl-ondo', items: [variant] },
    );
    swrCacheUtils.set(
      swrKeys.marketStockDetail({ stockId: 'AAPL', locale: 'en-us' }),
      { stockId: 'AAPL', data: { stockId: 'AAPL', name: 'Apple Inc.' } },
    );
    serviceMarketV2.fetchMarketStockDetail.mockRejectedValue(
      new Error('offline'),
    );
    serviceMarketV2.fetchMarketStockTokenVariants.mockRejectedValue(
      new Error('offline'),
    );

    const wrapper = ({ children }: PropsWithChildren) => (
      <StockDetailProvider stockId="AAPL">{children}</StockDetailProvider>
    );
    const { result } = renderHook(() => useStockDetail(), { wrapper });

    // Wait for the rejections to be processed, not merely dispatched: the
    // replayed cache is on screen from the first frame, so asserting before
    // the failure lands would pass either way.
    await waitFor(() =>
      expect(
        serviceMarketV2.fetchMarketStockDetail.mock.calls.length,
      ).toBeGreaterThan(0),
    );
    await waitFor(() =>
      expect(
        serviceMarketV2.fetchMarketStockTokenVariants.mock.calls.length,
      ).toBeGreaterThan(0),
    );
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(result.current.isStockDetailError).toBe(false);
    expect(result.current.stockDetail?.name).toBe('Apple Inc.');
    expect(result.current.tokenVariants).toHaveLength(1);
    expect(result.current.selectedTokenVariant?.tokenId).toBe('aapl-ondo');
  });

  it('releases initial layout loading when every token variant is paused', async () => {
    serviceMarketV2.fetchMarketStockTokenVariants.mockResolvedValue({
      stockId: 'AAPL',
      items: [
        {
          tokenId: 'aapl-paused',
          issuer: 'ondo',
          networkId: 'evm--1',
          contractAddress: '0xpaused',
          currency: 'USD',
          status: 'paused',
          tradingEnabled: false,
        },
      ],
    });
    const wrapper = ({ children }: PropsWithChildren) => (
      <StockDetailProvider stockId="AAPL">{children}</StockDetailProvider>
    );
    const { result } = renderHook(() => useStockDetail(), { wrapper });
    expect(result.current.isTokenVariantPending).toBe(true);
    await waitFor(() =>
      expect(result.current.isTokenVariantPending).toBe(false),
    );
    expect(result.current.selectedTokenVariant).toBeUndefined();
  });

  it('falls back to the first tradable token when the backend default is disabled', async () => {
    serviceMarketV2.fetchMarketStockDetail.mockResolvedValue({
      stockId: 'AAPL',
      symbol: 'AAPL',
      name: 'Apple Inc.',
      logoUrl: '',
      assetType: 'stock',
      currency: 'USD',
      categories: [],
      aliases: [],
    });
    serviceMarketV2.fetchMarketStockTokenVariants.mockResolvedValue({
      stockId: 'AAPL',
      defaultTokenId: 'aapl-paused',
      items: [
        {
          tokenId: 'aapl-paused',
          issuer: 'ondo',
          networkId: 'evm--1',
          contractAddress: '0xpaused',
          currency: 'USD',
          status: 'paused',
          tradingEnabled: false,
        },
        {
          tokenId: 'aapl-active',
          issuer: 'ondo',
          networkId: 'evm--56',
          contractAddress: '0xactive',
          currency: 'USD',
          status: 'active',
          tradingEnabled: true,
        },
      ],
    });

    const wrapper = ({ children }: PropsWithChildren) => (
      <StockDetailProvider stockId="AAPL">{children}</StockDetailProvider>
    );
    const { result } = renderHook(() => useStockDetail(), { wrapper });

    await waitFor(() => {
      expect(result.current.selectedTokenId).toBe('aapl-active');
    });
  });

  it('prefers the token variant selected by the stock route', async () => {
    serviceMarketV2.fetchMarketStockDetail.mockResolvedValue({
      stockId: 'AAPL',
      symbol: 'AAPL',
      name: 'Apple Inc.',
      logoUrl: '',
      assetType: 'stock',
      currency: 'USD',
      categories: [],
      aliases: [],
    });
    serviceMarketV2.fetchMarketStockTokenVariants.mockResolvedValue({
      stockId: 'AAPL',
      defaultTokenId: 'aapl-ondo',
      items: [
        {
          tokenId: 'aapl-xstock',
          issuer: 'xstock',
          networkId: 'sol--101',
          contractAddress: 'AAPLx',
          currency: 'USD',
          status: 'active',
          tradingEnabled: true,
        },
        {
          tokenId: 'aapl-ondo',
          issuer: 'ondo',
          networkId: 'evm--1',
          contractAddress: '0xaapl',
          currency: 'USD',
          status: 'active',
          tradingEnabled: true,
        },
      ],
    });

    const wrapper = ({ children }: PropsWithChildren) => (
      <StockDetailProvider
        stockId="AAPL"
        initialNetworkId="sol--101"
        initialTokenAddress="AAPLx"
      >
        {children}
      </StockDetailProvider>
    );
    const { result } = renderHook(() => useStockDetail(), { wrapper });

    await waitFor(() => {
      expect(result.current.selectedTokenId).toBe('aapl-xstock');
    });
  });

  it('applies a new route variant once and preserves subsequent manual selection', async () => {
    serviceMarketV2.fetchMarketStockDetail.mockResolvedValue({
      stockId: 'AAPL',
      symbol: 'AAPL',
      name: 'Apple Inc.',
      logoUrl: '',
      assetType: 'stock',
      currency: 'USD',
      categories: [],
      aliases: [],
    });
    serviceMarketV2.fetchMarketStockTokenVariants.mockResolvedValue({
      stockId: 'AAPL',
      defaultTokenId: 'aapl-ondo',
      items: [
        {
          tokenId: 'aapl-xstock',
          issuer: 'xstock',
          networkId: 'sol--101',
          contractAddress: 'AAPLx',
          currency: 'USD',
          status: 'active',
          tradingEnabled: true,
        },
        {
          tokenId: 'aapl-ondo',
          issuer: 'ondo',
          networkId: 'evm--1',
          contractAddress: '0xaapl',
          currency: 'USD',
          status: 'active',
          tradingEnabled: true,
        },
      ],
    });

    let routeNetwork = 'evm--1';
    let routeAddress = '0xaapl';
    const wrapper = ({ children }: PropsWithChildren) => (
      <StockDetailProvider
        stockId="AAPL"
        initialNetworkId={routeNetwork}
        initialTokenAddress={routeAddress}
      >
        {children}
      </StockDetailProvider>
    );
    const { result, rerender } = renderHook(() => useStockDetail(), {
      wrapper,
    });

    await waitFor(() =>
      expect(result.current.selectedTokenId).toBe('aapl-ondo'),
    );
    routeNetwork = 'sol--101';
    routeAddress = 'AAPLx';
    rerender();
    await waitFor(() =>
      expect(result.current.selectedTokenId).toBe('aapl-xstock'),
    );
    act(() => result.current.setSelectedTokenId('aapl-ondo'));
    await act(async () => {
      await result.current.retryTokenVariants();
    });
    expect(result.current.selectedTokenId).toBe('aapl-ondo');
  });

  it.each([
    {
      networkId: 'evm--1',
      address: '0xaabb',
      updatedAddress: '0xAaBb',
      expected: 'manual',
    },
    {
      networkId: 'sol--101',
      address: 'AAPLx',
      updatedAddress: 'AAPLX',
      expected: 'updated',
    },
  ])(
    'compares route addresses using $networkId identity rules',
    async ({ networkId, address, updatedAddress, expected }) => {
      serviceMarketV2.fetchMarketStockDetail.mockResolvedValue(null);
      serviceMarketV2.fetchMarketStockTokenVariants.mockResolvedValue({
        stockId: 'AAPL',
        defaultTokenId: 'initial',
        items: [
          {
            tokenId: 'initial',
            issuer: 'xstock',
            networkId,
            contractAddress: address,
            currency: 'USD',
            status: 'active',
            tradingEnabled: true,
          },
          {
            tokenId: 'manual',
            issuer: 'ondo',
            networkId,
            contractAddress: 'manual-address',
            currency: 'USD',
            status: 'active',
            tradingEnabled: true,
          },
          ...(networkId === 'sol--101'
            ? [
                {
                  tokenId: 'updated',
                  issuer: 'xstock',
                  networkId,
                  contractAddress: updatedAddress,
                  currency: 'USD' as const,
                  status: 'active',
                  tradingEnabled: true,
                },
              ]
            : []),
        ],
      });
      let routeAddress = address;
      const wrapper = ({ children }: PropsWithChildren) => (
        <StockDetailProvider
          stockId="AAPL"
          initialNetworkId={networkId}
          initialTokenAddress={routeAddress}
        >
          {children}
        </StockDetailProvider>
      );
      const { result, rerender } = renderHook(() => useStockDetail(), {
        wrapper,
      });
      await waitFor(() =>
        expect(result.current.selectedTokenId).toBe('initial'),
      );
      act(() => result.current.setSelectedTokenId('manual'));
      routeAddress = updatedAddress;
      rerender();
      await waitFor(() =>
        expect(result.current.selectedTokenId).toBe(expected),
      );
    },
  );

  it('matches EVM route addresses without checksum casing', async () => {
    serviceMarketV2.fetchMarketStockDetail.mockResolvedValue({
      stockId: 'AAPL',
      symbol: 'AAPL',
      name: 'Apple Inc.',
      logoUrl: '',
      assetType: 'stock',
      currency: 'USD',
      categories: [],
      aliases: [],
    });
    serviceMarketV2.fetchMarketStockTokenVariants.mockResolvedValue({
      stockId: 'AAPL',
      defaultTokenId: 'aapl-xstock',
      items: [
        {
          tokenId: 'aapl-xstock',
          issuer: 'xstock',
          networkId: 'sol--101',
          contractAddress: 'AAPLx',
          currency: 'USD',
          status: 'active',
          tradingEnabled: true,
        },
        {
          tokenId: 'aapl-ondo',
          issuer: 'ondo',
          networkId: 'evm--1',
          contractAddress: '0xAaBbCcDd',
          currency: 'USD',
          status: 'active',
          tradingEnabled: true,
        },
      ],
    });

    const wrapper = ({ children }: PropsWithChildren) => (
      <StockDetailProvider
        stockId="AAPL"
        initialNetworkId="evm--1"
        initialTokenAddress="0xaabbccdd"
      >
        {children}
      </StockDetailProvider>
    );
    const { result } = renderHook(() => useStockDetail(), { wrapper });

    await waitFor(() => {
      expect(result.current.selectedTokenId).toBe('aapl-ondo');
    });
  });

  it('preserves the selected variant across polling failures and paused updates', async () => {
    serviceMarketV2.fetchMarketStockDetail.mockResolvedValue({
      stockId: 'AAPL',
      symbol: 'AAPL',
      name: 'Apple Inc.',
      logoUrl: '',
      assetType: 'stock',
      currency: 'USD',
      categories: [],
      aliases: [],
    });
    const activeVariants: IMarketStockTokenVariant[] = [
      {
        tokenId: 'aapl-xstock',
        issuer: 'xstock',
        networkId: 'sol--101',
        contractAddress: 'AAPLx',
        currency: 'USD',
        status: 'active',
        tradingEnabled: true,
      },
      {
        tokenId: 'aapl-ondo',
        issuer: 'ondo',
        networkId: 'evm--1',
        contractAddress: '0xaapl',
        currency: 'USD',
        status: 'active',
        tradingEnabled: true,
      },
    ];
    serviceMarketV2.fetchMarketStockTokenVariants.mockResolvedValueOnce({
      stockId: 'AAPL',
      defaultTokenId: 'aapl-xstock',
      items: activeVariants,
    });

    const wrapper = ({ children }: PropsWithChildren) => (
      <StockDetailProvider stockId="AAPL">{children}</StockDetailProvider>
    );
    const { result } = renderHook(() => useStockDetail(), { wrapper });

    await waitFor(() => {
      expect(result.current.selectedTokenId).toBe('aapl-xstock');
    });
    act(() => {
      result.current.setSelectedTokenId('aapl-ondo');
    });
    expect(result.current.selectedTokenId).toBe('aapl-ondo');

    serviceMarketV2.fetchMarketStockTokenVariants.mockRejectedValueOnce(
      new Error('temporary network failure'),
    );
    await act(async () => {
      await result.current.retryTokenVariants();
    });

    await waitFor(() => {
      expect(result.current.isTokenVariantsError).toBe(true);
      expect(result.current.tokenVariants).toEqual(activeVariants);
      expect(result.current.selectedTokenId).toBe('aapl-ondo');
    });

    serviceMarketV2.fetchMarketStockTokenVariants.mockResolvedValueOnce({
      stockId: 'AAPL',
      defaultTokenId: 'aapl-xstock',
      items: [
        activeVariants[0],
        {
          ...activeVariants[1],
          status: 'paused',
          tradingEnabled: false,
        },
      ],
    });
    await act(async () => {
      await result.current.retryTokenVariants();
    });

    await waitFor(() => {
      expect(result.current.isTokenVariantsError).toBe(false);
      expect(result.current.selectedTokenId).toBe('aapl-ondo');
      expect(result.current.selectedTokenVariant?.status).toBe('paused');
    });
  });

  it('exposes a retryable detail error without treating it as empty data', async () => {
    serviceMarketV2.fetchMarketStockDetail.mockRejectedValueOnce(
      new Error('utility unavailable'),
    );
    serviceMarketV2.fetchMarketStockTokenVariants.mockResolvedValue({
      stockId: 'AAPL',
      items: [],
    });

    const wrapper = ({ children }: PropsWithChildren) => (
      <StockDetailProvider stockId="AAPL">{children}</StockDetailProvider>
    );
    const { result } = renderHook(() => useStockDetail(), { wrapper });

    await waitFor(() => {
      expect(result.current.isStockDetailError).toBe(true);
    });

    serviceMarketV2.fetchMarketStockDetail.mockResolvedValue({
      stockId: 'AAPL',
      symbol: 'AAPL',
      name: 'Apple Inc.',
      logoUrl: '',
      assetType: 'stock',
      currency: 'USD',
      categories: [],
      aliases: [],
    });
    await act(async () => {
      await result.current.retryStockDetail();
    });

    await waitFor(() => {
      expect(result.current.isStockDetailError).toBe(false);
      expect(result.current.stockDetail?.stockId).toBe('AAPL');
    });
  });

  it('exposes a retryable detail error when the stock is missing', async () => {
    serviceMarketV2.fetchMarketStockDetail.mockResolvedValueOnce(null);
    serviceMarketV2.fetchMarketStockTokenVariants.mockResolvedValue({
      stockId: 'AAPL',
      items: [],
    });

    const wrapper = ({ children }: PropsWithChildren) => (
      <StockDetailProvider stockId="AAPL">{children}</StockDetailProvider>
    );
    const { result } = renderHook(() => useStockDetail(), { wrapper });

    await waitFor(() => {
      expect(result.current.isStockDetailError).toBe(true);
    });
    expect(result.current.stockDetail).toBeUndefined();
  });

  it('keeps the last loaded detail when a refresh fails', async () => {
    serviceMarketV2.fetchMarketStockDetail.mockResolvedValueOnce({
      stockId: 'AAPL',
      symbol: 'AAPL',
      name: 'Apple Inc.',
      logoUrl: '',
      assetType: 'stock',
      currency: 'USD',
      categories: [],
      aliases: [],
    });
    serviceMarketV2.fetchMarketStockTokenVariants.mockResolvedValue({
      stockId: 'AAPL',
      items: [],
    });

    const wrapper = ({ children }: PropsWithChildren) => (
      <StockDetailProvider stockId="AAPL">{children}</StockDetailProvider>
    );
    const { result } = renderHook(() => useStockDetail(), { wrapper });

    await waitFor(() => {
      expect(result.current.stockDetail?.stockId).toBe('AAPL');
    });

    // A failing refresh (the polling tick takes the same path) must leave the
    // loaded page alone instead of flipping it to the error state.
    serviceMarketV2.fetchMarketStockDetail.mockRejectedValue(
      new Error('utility unavailable'),
    );
    await act(async () => {
      await result.current.retryStockDetail();
    });

    expect(serviceMarketV2.fetchMarketStockDetail.mock.calls).toHaveLength(2);
    expect(result.current.stockDetail?.stockId).toBe('AAPL');
    expect(result.current.isStockDetailError).toBe(false);
  });

  it('does not let a superseded response replace the current stock fallback', async () => {
    const appleRequest = createDeferred<IMarketStockPublicDetail>();
    const appleDetail: IMarketStockPublicDetail = {
      stockId: 'AAPL',
      symbol: 'AAPL',
      name: 'Apple Inc.',
      logoUrl: '',
      assetType: 'stock',
      currency: 'USD',
      categories: [],
      aliases: [],
    };
    const microsoftDetail: IMarketStockPublicDetail = {
      stockId: 'MSFT',
      symbol: 'MSFT',
      name: 'Microsoft Corp.',
      logoUrl: '',
      assetType: 'stock',
      currency: 'USD',
      categories: [],
      aliases: [],
    };
    serviceMarketV2.fetchMarketStockDetail
      .mockImplementationOnce(() => appleRequest.promise)
      .mockResolvedValueOnce(microsoftDetail)
      .mockRejectedValueOnce(new Error('temporary network failure'));
    serviceMarketV2.fetchMarketStockTokenVariants.mockImplementation(
      async ({ stockId }) => ({ stockId, items: [] }),
    );

    let stockId = 'AAPL';
    const wrapper = ({ children }: PropsWithChildren) => (
      <StockDetailProvider stockId={stockId}>{children}</StockDetailProvider>
    );
    const { result, rerender } = renderHook(() => useStockDetail(), {
      wrapper,
    });

    await waitFor(() => {
      expect(serviceMarketV2.fetchMarketStockDetail.mock.calls).toContainEqual([
        { stockId: 'AAPL' },
      ]);
    });

    stockId = 'MSFT';
    rerender();
    await waitFor(() => {
      expect(result.current.stockDetail?.stockId).toBe('MSFT');
    });

    await act(async () => {
      appleRequest.resolve(appleDetail);
      await appleRequest.promise;
    });
    await act(async () => {
      await result.current.retryStockDetail();
    });

    expect(result.current.stockDetail?.stockId).toBe('MSFT');
    expect(result.current.isStockDetailError).toBe(false);
  });

  describe('route focus gating', () => {
    const mockLoadedStock = () => {
      serviceMarketV2.fetchMarketStockDetail.mockResolvedValue({
        stockId: 'AAPL',
        symbol: 'AAPL',
        name: 'Apple Inc.',
        logoUrl: '',
        assetType: 'stock',
        currency: 'USD',
        categories: [],
        aliases: [],
      });
      serviceMarketV2.fetchMarketStockTokenVariants.mockResolvedValue({
        stockId: 'AAPL',
        items: [],
      });
    };

    it('holds the detail request while the route is blurred and issues it on focus', async () => {
      mockLoadedStock();
      act(() => {
        focusControl.__setFocus(false);
      });

      const wrapper = ({ children }: PropsWithChildren) => (
        <StockDetailProvider stockId="AAPL">{children}</StockDetailProvider>
      );
      const { result } = renderHook(() => useStockDetail(), { wrapper });

      await flushTaskQueues();
      await flushTaskQueues();

      // `checkIsFocused` must stay at its default: a blurred route never starts
      // the request, which is the same gate that keeps the polling loop parked.
      expect(serviceMarketV2.fetchMarketStockDetail.mock.calls).toHaveLength(0);

      act(() => {
        focusControl.__setFocus(true);
      });

      await waitFor(() => {
        expect(result.current.stockDetail?.stockId).toBe('AAPL');
      });
      expect(serviceMarketV2.fetchMarketStockDetail.mock.calls).toHaveLength(1);
    });

    it('parks the polling loop while blurred and resumes it on focus', async () => {
      mockLoadedStock();
      jest.useFakeTimers();

      try {
        const wrapper = ({ children }: PropsWithChildren) => (
          <StockDetailProvider stockId="AAPL">{children}</StockDetailProvider>
        );
        renderHook(() => useStockDetail(), { wrapper });

        await act(async () => {
          await jest.advanceTimersByTimeAsync(0);
        });
        expect(serviceMarketV2.fetchMarketStockDetail.mock.calls).toHaveLength(
          1,
        );

        // Two polling windows with the page focused: the loop keeps ticking.
        await act(async () => {
          await jest.advanceTimersByTimeAsync(STOCK_DETAIL_POLLING_MS * 2);
        });
        const focusedCalls =
          serviceMarketV2.fetchMarketStockDetail.mock.calls.length;
        expect(focusedCalls).toBeGreaterThan(1);

        act(() => {
          focusControl.__setFocus(false);
        });
        await act(async () => {
          await jest.advanceTimersByTimeAsync(STOCK_DETAIL_POLLING_MS * 4);
        });

        // The whole point of the fix: leaving the page behind in the navigation
        // stack must stop the 15s quote refresh instead of running it forever.
        expect(serviceMarketV2.fetchMarketStockDetail.mock.calls.length).toBe(
          focusedCalls,
        );

        act(() => {
          focusControl.__setFocus(true);
        });
        await act(async () => {
          await jest.advanceTimersByTimeAsync(0);
        });
        const resumedCalls =
          serviceMarketV2.fetchMarketStockDetail.mock.calls.length;
        // Refocus re-fetches straight away — this is why `revalidateOnFocus` is
        // not set: it would add a second polling chain for the same page.
        expect(resumedCalls).toBeGreaterThan(focusedCalls);

        await act(async () => {
          await jest.advanceTimersByTimeAsync(STOCK_DETAIL_POLLING_MS * 2);
        });
        const afterResumeCalls =
          serviceMarketV2.fetchMarketStockDetail.mock.calls.length;
        // Exactly one chain is running again: two windows, two more ticks.
        expect(afterResumeCalls - resumedCalls).toBe(2);
      } finally {
        jest.useRealTimers();
      }
    });
  });

  it('exposes the network its portfolio data is scoped to', async () => {
    serviceMarketV2.fetchMarketStockDetail.mockResolvedValue({
      stockId: 'AAPL',
      symbol: 'AAPL',
      name: 'Apple Inc.',
      logoUrl: '',
      assetType: 'stock',
      currency: 'USD',
      categories: [],
      aliases: [],
    });
    serviceMarketV2.fetchMarketStockTokenVariants.mockResolvedValue({
      stockId: 'AAPL',
      items: [],
    });

    const wrapper = ({ children }: PropsWithChildren) => (
      <StockDetailProvider stockId="AAPL" initialNetworkId="evm--1">
        {children}
      </StockDetailProvider>
    );
    const { result } = renderHook(() => useStockDetail(), { wrapper });

    await waitFor(() => {
      expect(result.current.portfolioNetworkId).toBe('evm--1');
    });
  });
});
