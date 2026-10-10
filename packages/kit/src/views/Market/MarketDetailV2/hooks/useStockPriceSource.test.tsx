/** @jest-environment jsdom */

import { act, renderHook } from '@testing-library/react';

import type { IMarketPriceSource } from '@onekeyhq/kit-bg/src/states/jotai/atoms';

import {
  resolveDisplayedStockPriceMode,
  useStockPriceSource,
} from './useStockPriceSource';

let mockInitialPriceSource: IMarketPriceSource = 'share';

let mockStock: {
  stockId?: string;
  stockDetail?: { marketStatus?: { isOpen: boolean } };
  isStockDetailError?: boolean;
};

jest.mock('./StockDetailContext', () => ({
  useStockDetail: () => mockStock,
}));

jest.mock('@onekeyhq/kit-bg/src/states/jotai/atoms', () => ({
  useMarketPriceSourceAtom: () => {
    const { useState } = jest.requireActual<typeof import('react')>('react');
    return useState<{ source: IMarketPriceSource }>({
      source: mockInitialPriceSource,
    });
  },
}));

describe('resolveDisplayedStockPriceMode', () => {
  it('keeps the stored share source while the quote is available', () => {
    expect(
      resolveDisplayedStockPriceMode({
        stockId: 'AAPL',
        storedPriceMode: 'share',
      }),
    ).toBe('share');
  });

  it('shows the token price when the share quote failed', () => {
    expect(
      resolveDisplayedStockPriceMode({
        stockId: 'AAPL',
        isStockDetailError: true,
        storedPriceMode: 'share',
      }),
    ).toBe('token');
  });
});

describe.each(['share', 'token'] as const)(
  'useStockPriceSource (initial source=%s)',
  (initialSource) => {
    beforeEach(() => {
      mockInitialPriceSource = initialSource;
      mockStock = { stockId: 'AAPL' };
    });

    it.each([
      [false, 'token'],
      [true, 'share'],
    ] as const)('defaults isOpen=%s to %s after loading', (isOpen, source) => {
      const { result, rerender } = renderHook(() => useStockPriceSource());
      expect(result.current.priceMode).toBe('token');

      mockStock.stockDetail = { marketStatus: { isOpen } };
      rerender();

      expect(result.current.priceMode).toBe(source);
    });

    it.each([false, true])(
      'uses an already loaded isOpen=%s status on mount',
      (isOpen) => {
        mockStock.stockDetail = { marketStatus: { isOpen } };
        const { result } = renderHook(() => useStockPriceSource());
        expect(result.current.priceMode).toBe(isOpen ? 'share' : 'token');
      },
    );

    it('defaults a closed market to Token Price on both cold entry and cached re-entry', () => {
      const first = renderHook(() => useStockPriceSource());
      expect(first.result.current.priceMode).toBe('token');
      mockStock.stockDetail = { marketStatus: { isOpen: false } };
      first.rerender();
      expect(first.result.current.priceMode).toBe('token');
      first.unmount();

      const second = renderHook(() => useStockPriceSource());
      expect(second.result.current.priceMode).toBe('token');
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
  },
);
