/** @jest-environment jsdom */

import { act, renderHook } from '@testing-library/react';

import { prewarmMarketTokenImages } from '../../utils/marketDetailImagePreload';

import { prefetchMarketTokenSelection } from './navigateToMarketTokenDetail';
import {
  MARKET_TOKEN_SELECTOR_HOVER_PREFETCH_DELAY_MS,
  useMarketTokenSelectorRowPrefetch,
} from './useMarketTokenSelectorRowPrefetch';

import type { IMarketToken } from '../../../MarketHomeV2/components/MarketTokenList/MarketTokenData';

jest.mock('../../utils/marketDetailImagePreload', () => ({
  prewarmMarketTokenImages: jest.fn(),
}));

jest.mock('./navigateToMarketTokenDetail', () => ({
  prefetchMarketTokenSelection: jest.fn(),
}));

const mockPrewarmMarketTokenImages = jest.mocked(prewarmMarketTokenImages);
const mockPrefetchMarketTokenSelection = jest.mocked(
  prefetchMarketTokenSelection,
);

function createToken(overrides?: Partial<IMarketToken>): IMarketToken {
  return {
    id: 'token-id',
    name: 'Token',
    symbol: 'TOKEN',
    address: '0x1234',
    decimals: 18,
    price: 1,
    change24h: 0,
    marketCap: 1,
    liquidity: 1,
    transactions: 1,
    uniqueTraders: 1,
    holders: 1,
    turnover: 1,
    tokenImageUri: 'https://example.com/token.png',
    networkLogoUri: 'https://example.com/network.png',
    networkId: 'evm--1',
    firstTradeTime: 123,
    ...overrides,
  };
}

describe('useMarketTokenSelectorRowPrefetch', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    mockPrewarmMarketTokenImages.mockReset();
    mockPrefetchMarketTokenSelection.mockReset();
  });

  afterEach(() => {
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
  });

  it('prefetches market data after a 150ms hover', () => {
    const token = createToken();
    const { result } = renderHook(() =>
      useMarketTokenSelectorRowPrefetch(token),
    );

    act(() => result.current.handleHoverIn());

    expect(mockPrewarmMarketTokenImages).toHaveBeenCalledWith(token);
    expect(mockPrefetchMarketTokenSelection).not.toHaveBeenCalled();

    act(() => {
      jest.advanceTimersByTime(
        MARKET_TOKEN_SELECTOR_HOVER_PREFETCH_DELAY_MS - 1,
      );
    });
    expect(mockPrefetchMarketTokenSelection).not.toHaveBeenCalled();

    act(() => jest.advanceTimersByTime(1));
    expect(mockPrefetchMarketTokenSelection).toHaveBeenCalledWith({
      address: token.address,
      networkId: token.networkId,
      firstTradeTime: token.firstTradeTime,
    });
  });

  it('cancels a pending hover prefetch when the pointer leaves', () => {
    const { result } = renderHook(() =>
      useMarketTokenSelectorRowPrefetch(createToken()),
    );

    act(() => result.current.handleHoverIn());
    act(() => result.current.cancelHoverPrefetch());
    act(() =>
      jest.advanceTimersByTime(MARKET_TOKEN_SELECTOR_HOVER_PREFETCH_DELAY_MS),
    );

    expect(mockPrefetchMarketTokenSelection).not.toHaveBeenCalled();
  });

  it('prefetches immediately on press and cancels the hover timer', () => {
    const token = createToken();
    const { result } = renderHook(() =>
      useMarketTokenSelectorRowPrefetch(token),
    );

    act(() => result.current.handleHoverIn());
    act(() => result.current.handlePressIn());

    expect(mockPrefetchMarketTokenSelection).toHaveBeenCalledTimes(1);
    expect(mockPrefetchMarketTokenSelection).toHaveBeenCalledWith({
      address: token.address,
      networkId: token.networkId,
      firstTradeTime: token.firstTradeTime,
    });

    act(() =>
      jest.advanceTimersByTime(MARKET_TOKEN_SELECTOR_HOVER_PREFETCH_DELAY_MS),
    );
    expect(mockPrefetchMarketTokenSelection).toHaveBeenCalledTimes(1);
  });

  it('only prewarms images for perps rows', () => {
    const token = createToken({ perpsCoin: 'BTC' });
    const { result } = renderHook(() =>
      useMarketTokenSelectorRowPrefetch(token),
    );

    act(() => result.current.handleHoverIn());
    act(() =>
      jest.advanceTimersByTime(MARKET_TOKEN_SELECTOR_HOVER_PREFETCH_DELAY_MS),
    );

    expect(mockPrewarmMarketTokenImages).toHaveBeenCalledWith(token);
    expect(mockPrefetchMarketTokenSelection).not.toHaveBeenCalled();
  });
});
