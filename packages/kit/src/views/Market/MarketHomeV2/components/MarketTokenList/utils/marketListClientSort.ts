import type { IMarketToken } from '../MarketTokenData';

// dataIndex (table column) -> IMarketToken field for client-side sorting.
// Trending list data arrives as one full pool (backend ignores page/limit),
// so sorting locally over rawData equals sorting the whole trending pool.
export const MARKET_CLIENT_SORT_FIELD_MAP: Record<string, keyof IMarketToken> =
  {
    price: 'price',
    change24h: 'change24h',
    marketCap: 'marketCap',
    liquidity: 'liquidity',
    turnover: 'turnover',
    transactions: 'transactions',
    uniqueTraders: 'uniqueTraders',
    holders: 'holders',
    tokenAge: 'firstTradeTime',
  };

function isMissingSortValue(value: unknown): boolean {
  return (
    value === undefined ||
    value === null ||
    (typeof value === 'number' && Number.isNaN(value))
  );
}

export function sortMarketTokensClient(
  tokens: IMarketToken[],
  field: keyof IMarketToken,
  direction: 'asc' | 'desc',
): IMarketToken[] {
  return tokens.toSorted((a, b) => {
    const aVal = a[field] as number | undefined;
    const bVal = b[field] as number | undefined;
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
