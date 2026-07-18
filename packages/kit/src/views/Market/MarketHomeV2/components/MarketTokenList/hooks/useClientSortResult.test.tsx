/**
 * @jest-environment jsdom
 */
import { act, renderHook } from '@testing-library/react';

import { useClientSortResult } from './useClientSortResult';

import type { IMarketTokenListResult } from '../MarketTokenListBase';

const baseResult: IMarketTokenListResult = {
  data: [],
  isLoading: false,
  setSortBy: jest.fn(),
  setSortType: jest.fn(),
  initialSortBy: 'v24hUSD',
  initialSortType: 'desc',
};

describe('useClientSortResult', () => {
  it('keeps sort state local and never calls underlying setters', () => {
    const { result } = renderHook(() => useClientSortResult(baseResult));
    act(() => {
      result.current.setSortBy('marketCap');
      result.current.setSortType('desc');
    });
    expect(result.current.currentSortBy).toBe('marketCap');
    expect(result.current.currentSortType).toBe('desc');
    expect(baseResult.setSortBy).not.toHaveBeenCalled();
    expect(baseResult.setSortType).not.toHaveBeenCalled();
  });

  it('returns undefined initial sort so reset restores server order', () => {
    const { result } = renderHook(() => useClientSortResult(baseResult));
    expect(result.current.initialSortBy).toBeUndefined();
    expect(result.current.initialSortType).toBeUndefined();
  });

  it('clears sort state when resetKey changes', () => {
    const { result, rerender } = renderHook(
      ({ resetKey }) => useClientSortResult(baseResult, { resetKey }),
      { initialProps: { resetKey: 0 } },
    );
    act(() => {
      result.current.setSortBy('price');
      result.current.setSortType('asc');
    });
    rerender({ resetKey: 1 });
    expect(result.current.currentSortBy).toBeUndefined();
    expect(result.current.currentSortType).toBeUndefined();
  });
});
