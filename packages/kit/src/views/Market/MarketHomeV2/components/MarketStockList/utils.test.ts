import type { IMarketStockPublicItem } from '@onekeyhq/shared/types/marketV2';

import {
  appendUniqueMarketStocks,
  buildStockSparklinePoints,
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

  it('builds safe sparkline points for normal and flat series', () => {
    expect(
      buildStockSparklinePoints({ data: [1, 2, 3], width: 100, height: 40 }),
    ).toBe('0.00,38.00 50.00,20.00 100.00,2.00');
    expect(
      buildStockSparklinePoints({ data: [5, 5], width: 100, height: 40 }),
    ).toBe('0.00,20.00 100.00,20.00');
    expect(
      buildStockSparklinePoints({ data: [1], width: 100, height: 40 }),
    ).toBeUndefined();
  });
});
