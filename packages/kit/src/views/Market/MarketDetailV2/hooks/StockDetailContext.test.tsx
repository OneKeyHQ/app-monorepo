/** @jest-environment jsdom */
import type { PropsWithChildren } from 'react';

import { act, renderHook, waitFor } from '@testing-library/react';

import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import type {
  IMarketStockPublicDetail,
  IMarketStockTokenVariant,
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
