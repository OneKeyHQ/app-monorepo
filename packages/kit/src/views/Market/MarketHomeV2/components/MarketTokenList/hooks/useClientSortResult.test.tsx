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

  it('reads sort from the external store when one is supplied', () => {
    const { result } = renderHook(() =>
      useClientSortResult(baseResult, {
        externalSort: {
          sortBy: 'turnover',
          sortType: 'desc',
          onChange: jest.fn(),
        },
      }),
    );
    expect(result.current.currentSortBy).toBe('turnover');
    expect(result.current.currentSortType).toBe('desc');
  });

  // Guards the chip<->header sync: the header writes sortBy and sortType in
  // two consecutive calls, so the second must merge onto the first rather than
  // overwrite it from a stale render snapshot.
  it('merges consecutive external sort writes', () => {
    let store: { sortBy?: string; sortType?: 'asc' | 'desc' } = {};
    const onChange = jest.fn(
      (updater: (prev: typeof store) => typeof store) => {
        store = updater(store);
      },
    );
    const { result } = renderHook(() =>
      useClientSortResult(baseResult, { externalSort: { ...store, onChange } }),
    );
    act(() => {
      result.current.setSortBy('marketCap');
      result.current.setSortType('asc');
    });
    expect(store).toEqual({ sortBy: 'marketCap', sortType: 'asc' });
  });
});
