/** @jest-environment jsdom */

import { act, renderHook } from '@testing-library/react';

import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';

import { useMarketStockList } from './useMarketStockList';

const mockRefresh = jest.fn();
let mockLoadFirstPage: (() => Promise<unknown>) | undefined;

jest.mock('@onekeyhq/kit/src/background/instance/backgroundApiProxy', () => ({
  __esModule: true,
  default: {
    serviceMarketV2: {
      fetchMarketStockList: jest.fn(),
    },
  },
}));

jest.mock('@onekeyhq/kit/src/hooks/usePromiseResult', () => ({
  usePromiseResult: (method: () => Promise<unknown>) => {
    mockLoadFirstPage = method;
    return {
      result: undefined,
      isLoading: false,
      run: mockRefresh,
    };
  },
}));

describe('useMarketStockList sorting', () => {
  const serviceMarketV2 = jest.mocked(backgroundApiProxy.serviceMarketV2);

  beforeEach(() => {
    jest.clearAllMocks();
    mockLoadFirstPage = undefined;
    serviceMarketV2.fetchMarketStockList.mockResolvedValue({
      items: [],
      total: 0,
    });
  });

  it('starts with 24h volume descending and sends it to the first page API', async () => {
    const { result } = renderHook(() =>
      useMarketStockList({ category: 'technology' }),
    );

    expect(result.current.sortBy).toBe('volume24h');
    expect(result.current.sortType).toBe('desc');

    await act(async () => {
      await mockLoadFirstPage?.();
    });

    expect(serviceMarketV2.fetchMarketStockList.mock.calls).toContainEqual([
      {
        limit: 20,
        category: 'technology',
        sortBy: 'volume24h',
        sortType: 'desc',
      },
    ]);
  });

  it('restores the default sorting after clearing another column', () => {
    const { result } = renderHook(() => useMarketStockList({}));

    act(() => result.current.setSorting('marketCap', 'asc'));
    expect(result.current.sortBy).toBe('marketCap');
    expect(result.current.sortType).toBe('asc');

    act(() => result.current.setSorting('marketCap', undefined));
    expect(result.current.sortBy).toBe('volume24h');
    expect(result.current.sortType).toBe('desc');
  });
});
