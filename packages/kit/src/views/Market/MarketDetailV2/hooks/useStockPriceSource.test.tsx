/** @jest-environment jsdom */

import { act, renderHook } from '@testing-library/react';

import type { IMarketPriceSource } from '@onekeyhq/kit-bg/src/states/jotai/atoms';

import { useStockPriceSource } from './useStockPriceSource';

let mockStock: {
  stockId: string;
  stockDetail?: { marketStatus?: { isOpen: boolean } };
};

jest.mock('./StockDetailContext', () => ({
  useStockDetail: () => mockStock,
}));

jest.mock('@onekeyhq/kit-bg/src/states/jotai/atoms', () => ({
  useMarketPriceSourceAtom: () => {
    const { useState } = jest.requireActual<typeof import('react')>('react');
    return useState<{ source: IMarketPriceSource }>({ source: 'share' });
  },
}));

describe('useStockPriceSource', () => {
  beforeEach(() => {
    mockStock = { stockId: 'AAPL' };
  });

  it.each([
    [false, 'token'],
    [true, 'share'],
  ] as const)('defaults isOpen=%s to %s after loading', (isOpen, source) => {
    const { result, rerender } = renderHook(() => useStockPriceSource());
    expect(result.current.priceMode).toBe('share');

    mockStock.stockDetail = { marketStatus: { isOpen } };
    rerender();

    expect(result.current.priceMode).toBe(source);
  });

  it('uses an already loaded closed-market status on mount', () => {
    mockStock.stockDetail = { marketStatus: { isOpen: false } };
    const { result } = renderHook(() => useStockPriceSource());
    expect(result.current.priceMode).toBe('token');
  });

  it('keeps Share Price when the market status is missing', () => {
    mockStock.stockDetail = {};
    const { result } = renderHook(() => useStockPriceSource());
    expect(result.current.priceMode).toBe('share');
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

  it('reinitializes on stock changes, including returning to a previous stock', () => {
    mockStock.stockDetail = { marketStatus: { isOpen: false } };
    const { result, rerender } = renderHook(() => useStockPriceSource());
    expect(result.current.priceMode).toBe('token');
    act(() => result.current.handlePriceModeChange('share'));

    mockStock = { stockId: 'MSFT' };
    rerender();
    expect(result.current.priceMode).toBe('share');
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
