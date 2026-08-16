import {
  getStockMarketCapValue,
  getStockPeRatioValue,
  getStockVolume24hValue,
} from './tokenListHelpers';

import type { IMarketToken } from '../MarketTokenData';

export type IMarketClientSortValueGetter = (
  token: IMarketToken,
) => string | number | undefined;

// The cell shows an age (now - firstTradeTime), which runs opposite to the raw
// timestamp: a newer token has the larger timestamp but the smaller age.
// Sorting the timestamp directly therefore inverts the arrow. Negating is
// order-isomorphic to the age and keeps the comparator stable, where reading
// the clock per comparison would not. Falsy timestamps yield undefined so they
// sink like the rows that render no age at all.
export const getTokenAgeSortValue: IMarketClientSortValueGetter = (token) =>
  token.firstTradeTime ? -token.firstTradeTime : undefined;

// dataIndex (table column) -> the IMarketToken field (or reader) that backs it.
// Sorting covers the rows currently in hand, not the server-side pool: only
// lists whose first page already returned everything hold the complete set.
export const MARKET_CLIENT_SORT_FIELD_MAP: Record<
  string,
  keyof IMarketToken | IMarketClientSortValueGetter
> = {
  price: 'price',
  change24h: 'change24h',
  marketCap: 'marketCap',
  liquidity: 'liquidity',
  turnover: 'turnover',
  transactions: 'transactions',
  uniqueTraders: 'uniqueTraders',
  holders: 'holders',
  tokenAge: getTokenAgeSortValue,
};

// Stock rows render metadata off `record.stock`, not the token's own numeric
// fields, and they reuse the marketCap/liquidity/turnover column slots. Sorting
// them by the mapped token field would order by a number the row never shows,
// so these columns read the displayed value instead.
export const MARKET_STOCK_CLIENT_SORT_VALUE_GETTERS: Record<
  string,
  IMarketClientSortValueGetter
> = {
  marketCap: getStockMarketCapValue,
  liquidity: getStockVolume24hValue,
  turnover: getStockPeRatioValue,
};

function isMissingSortValue(value: unknown): boolean {
  return (
    value === undefined || value === null || !Number.isFinite(Number(value))
  );
}

export function sortMarketTokensClient(
  tokens: IMarketToken[],
  fieldOrGetter: keyof IMarketToken | IMarketClientSortValueGetter,
  direction: 'asc' | 'desc',
): IMarketToken[] {
  const readValue =
    typeof fieldOrGetter === 'function'
      ? fieldOrGetter
      : (token: IMarketToken) =>
          token[fieldOrGetter] as string | number | undefined;

  return tokens.toSorted((a, b) => {
    const aVal = readValue(a);
    const bVal = readValue(b);
    const aMissing = isMissingSortValue(aVal);
    const bMissing = isMissingSortValue(bVal);
    if (aMissing || bMissing) {
      if (aMissing && bMissing) return 0;
      // Missing values always sink to the bottom in both directions.
      return aMissing ? 1 : -1;
    }
    const result = Number(aVal) - Number(bVal);
    return direction === 'asc' ? result : -result;
  });
}
