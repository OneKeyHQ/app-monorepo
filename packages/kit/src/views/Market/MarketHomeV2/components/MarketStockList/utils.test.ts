import type { IMarketStockPublicItem } from '@onekeyhq/shared/types/marketV2';

import {
  appendUniqueMarketStocks,
  buildMarketStockListQueryKey,
  downsampleStockSparkline,
  getMarketStockSortByColumn,
  parseMarketStockNumber,
} from './utils';

const createStock = (
  stockId: string,
  overrides: Partial<IMarketStockPublicItem> = {},
): IMarketStockPublicItem => ({
  stockId,
  symbol: stockId,
  name: stockId,
  logoUrl: '',
  assetType: 'stock',
  peRatio: '10',
  currency: 'USD',
  ...overrides,
});

describe('market stock list utils', () => {
  it('builds the same query key Home stocks persist under', () => {
    expect(
      buildMarketStockListQueryKey({
        locale: 'en-US',
      }),
    ).toBe(
      JSON.stringify({
        sortBy: 'marketCap',
        sortType: 'desc',
        locale: 'en-US',
      }),
    );
    expect(
      buildMarketStockListQueryKey({
        category: 'tech',
        locale: 'zh-CN',
        sortBy: 'volume24h',
        sortType: 'asc',
      }),
    ).toBe(
      JSON.stringify({
        category: 'tech',
        sortBy: 'volume24h',
        sortType: 'asc',
        locale: 'zh-CN',
      }),
    );
  });

  it('maps the four sortable stock columns to server fields', () => {
    expect(getMarketStockSortByColumn('price')).toBe('price');
    expect(getMarketStockSortByColumn('priceChange24hPercent')).toBe(
      'priceChange24hPercent',
    );
    expect(getMarketStockSortByColumn('marketCap')).toBe('marketCap');
    expect(getMarketStockSortByColumn('volume24h')).toBe('volume24h');
    expect(getMarketStockSortByColumn('company')).toBeUndefined();
    expect(getMarketStockSortByColumn('sparkline')).toBeUndefined();
  });

  it('parses only finite stock values', () => {
    expect(parseMarketStockNumber('12.5')).toBe(12.5);
    expect(parseMarketStockNumber('')).toBeUndefined();
    expect(parseMarketStockNumber('not-a-number')).toBeUndefined();
    expect(parseMarketStockNumber(Number.POSITIVE_INFINITY)).toBeUndefined();
  });

  it('keeps backend order while replacing duplicate stock ids', () => {
    const result = appendUniqueMarketStocks(
      [createStock('AAPL'), createStock('MSFT')],
      [createStock('MSFT', { price: '420' }), createStock('NVDA')],
    );

    expect(result.map((item) => item.stockId)).toEqual([
      'AAPL',
      'MSFT',
      'NVDA',
    ]);
    expect(result[1]?.price).toBe('420');
  });

  it('downsamples a full trading session to evenly spaced points', () => {
    const session = Array.from({ length: 390 }, (_, index) => index);
    const sampled = downsampleStockSparkline(session);

    expect(sampled).toHaveLength(40);
    expect(sampled[0]).toBe(0);
    expect(sampled[1]).toBe(10);
    expect(sampled.at(-1)).toBe(389);
  });

  it('keeps short series and drops non-finite sparkline values', () => {
    expect(downsampleStockSparkline([1, 2, 3])).toEqual([1, 2, 3]);
    expect(downsampleStockSparkline([1, Number.NaN, 3])).toEqual([1, 3]);
    expect(downsampleStockSparkline([1, 2, 3, 4, 5], 3)).toEqual([1, 3, 5]);
  });
});
