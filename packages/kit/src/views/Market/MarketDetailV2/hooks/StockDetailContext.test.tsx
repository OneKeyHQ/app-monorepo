/** @jest-environment jsdom */
import type { PropsWithChildren } from 'react';

import { act, renderHook, waitFor } from '@testing-library/react';

import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import type { IMarketStockTokenVariant } from '@onekeyhq/shared/types/marketV2';

import { StockDetailProvider, useStockDetail } from './StockDetailContext';

jest.mock('@onekeyhq/components', () => ({
  getCurrentVisibilityState: () => true,
  onVisibilityStateChange: () => () => undefined,
  useDeferredPromise: () => ({
    promise: Promise.resolve(),
    reset: jest.fn(),
    resolve: jest.fn(),
  }),
  useNetInfo: () => ({ isRawInternetReachable: true }),
}));

jest.mock('@onekeyhq/kit/src/background/instance/backgroundApiProxy', () => ({
  __esModule: true,
  default: {
    serviceMarketV2: {
      fetchMarketStockDetail: jest.fn(),
      fetchMarketStockTokenVariants: jest.fn(),
    },
  },
}));

jest.mock('@onekeyhq/kit/src/hooks/useRouteIsFocused', () => ({
  useRouteIsFocused: () => true,
}));

describe('StockDetailProvider', () => {
  const serviceMarketV2 = backgroundApiProxy.serviceMarketV2 as jest.Mocked<
    typeof backgroundApiProxy.serviceMarketV2
  >;

  beforeEach(() => {
    jest.clearAllMocks();
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
    });

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
});
