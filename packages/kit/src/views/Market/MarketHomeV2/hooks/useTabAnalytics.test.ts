/** @jest-environment jsdom */

import { renderHook } from '@testing-library/react';

import { useTabAnalytics } from './useTabAnalytics';

const mockDexList = jest.fn();

jest.mock('@onekeyhq/shared/src/logger/logger', () => ({
  defaultLogger: {
    dex: {
      list: {
        dexList: (payload: unknown) => {
          mockDexList(payload);
        },
      },
    },
  },
}));

describe('useTabAnalytics', () => {
  beforeEach(() => {
    mockDexList.mockClear();
  });

  it('skips the default selection and reports the exact tab and category', () => {
    const { result } = renderHook(() => useTabAnalytics());
    result.current.handleTabChange('trending', { categoryId: 'hot' });
    expect(mockDexList).not.toHaveBeenCalled();

    // Switching between spot categories is a tab change of its own.
    result.current.handleTabChange('trending', { categoryId: 'stocks' });
    expect(mockDexList).toHaveBeenLastCalledWith({
      dexListName: 'Trending',
      tabValue: 'trending',
      categoryId: 'stocks',
    });

    // Perps keeps the legacy name for comparison but carries its real tab.
    result.current.handleTabChange('perps');
    expect(mockDexList).toHaveBeenLastCalledWith({
      dexListName: 'Watchlist',
      tabValue: 'perps',
    });

    result.current.handleTabChange('perps');
    expect(mockDexList).toHaveBeenCalledTimes(2);
  });
});
