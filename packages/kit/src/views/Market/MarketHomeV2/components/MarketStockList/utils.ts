import type {
  IMarketStockPublicItem,
  IMarketStockPublicListSortBy,
} from '@onekeyhq/shared/types/marketV2';

const MARKET_STOCK_SORT_BY_COLUMN: Partial<
  Record<
    keyof IMarketStockPublicItem,
    Exclude<IMarketStockPublicListSortBy, 'default' | 'symbol'>
  >
> = {
  price: 'price',
  priceChange24hPercent: 'priceChange24hPercent',
  marketCap: 'marketCap',
  volume24h: 'volume24h',
};

export function getMarketStockSortByColumn(columnName: string) {
  return MARKET_STOCK_SORT_BY_COLUMN[
    columnName as keyof IMarketStockPublicItem
  ];
}

export function parseMarketStockNumber(
  value?: string | number | null,
): number | undefined {
  if (value === undefined || value === null || value === '') {
    return undefined;
  }
  const numberValue = Number(value);
  return Number.isFinite(numberValue) ? numberValue : undefined;
}

export function appendUniqueMarketStocks(
  current: IMarketStockPublicItem[],
  incoming: IMarketStockPublicItem[],
) {
  const stockMap = new Map(current.map((item) => [item.stockId, item]));
  incoming.forEach((item) => stockMap.set(item.stockId, item));
  return Array.from(stockMap.values());
}

// The API returns one point per trading minute (390 for a full US session).
// 40 evenly spaced samples keep roughly 10-minute steps and always keep the
// first and latest price.
export const STOCK_SPARKLINE_MAX_POINTS = 40;

export function downsampleStockSparkline(
  data: number[],
  maxPoints = STOCK_SPARKLINE_MAX_POINTS,
): number[] {
  const values = data.filter(Number.isFinite);
  if (values.length <= maxPoints || maxPoints < 2) {
    return values;
  }
  const step = (values.length - 1) / (maxPoints - 1);
  return Array.from(
    { length: maxPoints },
    (_, index) => values[Math.round(index * step)],
  );
}
