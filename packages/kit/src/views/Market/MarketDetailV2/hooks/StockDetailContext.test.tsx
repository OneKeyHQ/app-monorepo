/** @jest-environment jsdom */
import type { PropsWithChildren } from 'react';

import { act, renderHook, waitFor } from '@testing-library/react';

import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';

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
});
