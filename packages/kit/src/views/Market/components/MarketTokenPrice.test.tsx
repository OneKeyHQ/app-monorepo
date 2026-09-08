/** @jest-environment jsdom */
import { renderHook } from '@testing-library/react';

import { useTokenPrice } from './MarketTokenPrice';

describe('useTokenPrice', () => {
  it('isolates prices and timestamps by cache key', () => {
    const { result, rerender } = renderHook(
      (props: { cacheKey: string; price: string; lastUpdated: number }) =>
        useTokenPrice({
          name: 'Apple Inc.',
          symbol: 'AAPL',
          ...props,
        }),
      {
        initialProps: {
          cacheKey: 'stock-AAPL-share',
          price: '100',
          lastUpdated: 200,
        },
      },
    );

    expect(result.current).toBe('100');

    rerender({
      cacheKey: 'stock-AAPL-token',
      price: '101',
      lastUpdated: 100,
    });
    expect(result.current).toBe('101');

    rerender({
      cacheKey: 'stock-AAPL-token',
      price: '102',
      lastUpdated: 90,
    });
    expect(result.current).toBe('101');

    rerender({
      cacheKey: 'stock-AAPL-share',
      price: '100',
      lastUpdated: 200,
    });
    expect(result.current).toBe('100');
  });
});
