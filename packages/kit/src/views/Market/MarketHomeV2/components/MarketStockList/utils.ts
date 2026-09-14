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

export function buildStockSparklinePoints({
  data,
  width,
  height,
}: {
  data: number[];
  width: number;
  height: number;
}) {
  const values = data.filter(Number.isFinite);
  if (values.length < 2) {
    return undefined;
  }

  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min;
  const horizontalStep = width / (values.length - 1);
  const verticalPadding = 2;
  const drawableHeight = height - verticalPadding * 2;

  return values
    .map((value, index) => {
      const x = horizontalStep * index;
      const y =
        range === 0
          ? height / 2
          : verticalPadding + ((max - value) / range) * drawableHeight;
      return `${x.toFixed(2)},${y.toFixed(2)}`;
    })
    .join(' ');
}
