/** @jest-environment jsdom */

import type { SetStateAction } from 'react';

import { act, renderHook } from '@testing-library/react';

import type { IMarketPriceSource } from '@onekeyhq/kit-bg/src/states/jotai/atoms';

import { useStockPriceSourceState } from './stockPriceSourceState';

let mockInitialPriceSource: IMarketPriceSource = 'share';
let mockDeferPriceSource = false;
let mockPendingPriceSourceUpdates: (() => void)[] = [];

let mockStock: {
  stockId?: string;
  stockDetail?: { marketStatus?: { isOpen: boolean } };
  isStockDetailError?: boolean;
};

const useStockPriceSource = () => useStockPriceSourceState(mockStock);

jest.mock('@onekeyhq/kit-bg/src/states/jotai/atoms', () => ({
  useMarketPriceSourceAtom: () => {
    const { useCallback, useState } =
      jest.requireActual<typeof import('react')>('react');
    const [state, setState] = useState<{ source: IMarketPriceSource }>({
      source: mockInitialPriceSource,
    });
    const setSource = useCallback(
      (update: SetStateAction<{ source: IMarketPriceSource }>) => {
        const apply = () => setState(update);
        if (mockDeferPriceSource) mockPendingPriceSourceUpdates.push(apply);
        else apply();
      },
      [],
    );
    return [state, setSource];
  },
}));

beforeEach(() => {
  mockInitialPriceSource = 'share';
  mockDeferPriceSource = false;
  mockPendingPriceSourceUpdates = [];
  mockStock = { stockId: 'AAPL' };
});

describe('useStockPriceSourceState', () => {
  it.each([
    [false, 'token'],
    [true, 'share'],
  ] as const)('defaults isOpen=%s to %s after loading', (isOpen, source) => {
    const { result, rerender } = renderHook(() => useStockPriceSource());
    expect(result.current.priceMode).toBe('token');
    expect(result.current.isPriceSourceReady).toBe(false);

    mockStock.stockDetail = { marketStatus: { isOpen } };
    rerender();

    expect(result.current.priceMode).toBe(source);
    expect(result.current.isPriceSourceReady).toBe(true);
  });

  it.each([false, true])(
    'uses an already loaded isOpen=%s status on mount',
    (isOpen) => {
      mockStock.stockDetail = { marketStatus: { isOpen } };
      const { result } = renderHook(() => useStockPriceSource());
      expect(result.current.priceMode).toBe(isOpen ? 'share' : 'token');
    },
  );

  it('reveals the resolved mode locally before the native atom round-trip', () => {
    mockInitialPriceSource = 'token';
    mockDeferPriceSource = true;
    mockStock.stockDetail = { marketStatus: { isOpen: true } };
    const { result } = renderHook(() => useStockPriceSource());
    expect(result.current.isPriceSourceReady).toBe(true);
    expect(result.current.priceMode).toBe('share');
    act(() => {
      for (const apply of mockPendingPriceSourceUpdates.splice(0)) apply();
    });
    expect(result.current.isPriceSourceReady).toBe(true);
    expect(result.current.priceMode).toBe('share');
  });

  it('keeps Token Price when the market status is missing', () => {
    mockStock.stockDetail = {};
    const { result } = renderHook(() => useStockPriceSource());
    expect(result.current.priceMode).toBe('token');
  });

  it.each([
    [true, 'token'],
    [false, 'share'],
  ] as const)(
    'preserves manual %s -> %s through polling',
    (isInitiallyOpen, source) => {
      mockStock.stockDetail = { marketStatus: { isOpen: isInitiallyOpen } };
      const { result, rerender } = renderHook(() => useStockPriceSource());
      act(() => result.current.handlePriceModeChange(source));

      for (const isOpen of [true, false, true]) {
        mockStock.stockDetail = { marketStatus: { isOpen } };
        rerender();
        expect(result.current.priceMode).toBe(source);
      }
    },
  );

  it('preserves a manual Share Price choice before the response arrives', () => {
    const { result, rerender } = renderHook(() => useStockPriceSource());
    act(() => result.current.handlePriceModeChange('share'));

    mockStock.stockDetail = { marketStatus: { isOpen: false } };
    rerender();
    expect(result.current.priceMode).toBe('share');
  });

  it('shows the token price and does not force Share when stockId is missing', () => {
    mockStock = {};
    const { result, rerender } = renderHook(() => useStockPriceSource());

    expect(result.current.priceMode).toBe('token');
    expect(result.current.sharePriceAvailable).toBe(false);

    rerender();
    expect(result.current.priceMode).toBe('token');
  });

  it('falls back to the token price when the share quote failed', () => {
    mockStock = {
      stockId: 'AAPL',
      isStockDetailError: true,
      stockDetail: { marketStatus: { isOpen: true } },
    };
    const { result, rerender } = renderHook(() => useStockPriceSource());

    expect(result.current.priceMode).toBe('token');
    expect(result.current.sharePriceAvailable).toBe(false);

    mockStock = {
      stockId: 'AAPL',
      stockDetail: { marketStatus: { isOpen: true } },
    };
    rerender();

    expect(result.current.priceMode).toBe('share');
    expect(result.current.sharePriceAvailable).toBe(true);
  });

  it('reinitializes on stock changes, including returning to a previous stock', () => {
    mockStock.stockDetail = { marketStatus: { isOpen: false } };
    const { result, rerender } = renderHook(() => useStockPriceSource());
    expect(result.current.priceMode).toBe('token');
    act(() => result.current.handlePriceModeChange('share'));

    mockStock = { stockId: 'MSFT' };
    rerender();
    expect(result.current.priceMode).toBe('token');
    expect(result.current.isPriceSourceReady).toBe(false);
    mockStock.stockDetail = { marketStatus: { isOpen: true } };
    rerender();
    expect(result.current.priceMode).toBe('share');

    mockStock = {
      stockId: 'AAPL',
      stockDetail: { marketStatus: { isOpen: false } },
    };
    rerender();
    expect(result.current.priceMode).toBe('token');
  });
});

it('keeps a manual local choice when delayed global updates arrive', () => {
  mockDeferPriceSource = true;
  mockStock = {
    stockId: 'MANUAL',
    stockDetail: { marketStatus: { isOpen: true } },
  };
  const { result } = renderHook(() => useStockPriceSource());
  expect(result.current.priceMode).toBe('share');
  act(() => result.current.handlePriceModeChange('token'));
  expect(result.current.priceMode).toBe('token');
  act(() => {
    for (const apply of mockPendingPriceSourceUpdates.splice(0).toReversed())
      apply();
  });
  expect(result.current.priceMode).toBe('token');
  mockDeferPriceSource = false;
});

it('does not restore a previous stock manual choice after visiting a pending stock', () => {
  mockStock = { stockId: 'A' };
  const { result, rerender } = renderHook(() => useStockPriceSource());
  act(() => result.current.handlePriceModeChange('share'));
  mockStock = { stockId: 'B' };
  rerender();
  mockStock = { stockId: 'A' };
  rerender();
  expect(result.current.priceMode).toBe('token');
  expect(result.current.isPriceSourceReady).toBe(false);
});
