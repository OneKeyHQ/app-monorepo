import type { IMarketToken } from '../MarketTokenData';

export type IMarketWatchlistRowKind = 'token' | 'asset' | 'stock' | 'perps';

/**
 * Which sibling list a watchlist row mirrors. Spot tokens always carry a
 * network and listings never do, so the network check comes before the id
 * checks: a legacy chain favorite keeps its stored `stockId` next to its
 * address and must still render as a token.
 */
export function getMarketWatchlistRowKind(
  record: Pick<IMarketToken, 'perpsCoin' | 'networkId' | 'stockId' | 'assetId'>,
): IMarketWatchlistRowKind {
  if (record.perpsCoin) {
    return 'perps';
  }
  if (record.networkId) {
    return 'token';
  }
  if (record.stockId) {
    return 'stock';
  }
  if (record.assetId) {
    return 'asset';
  }
  return 'token';
}

/**
 * The company name of a stock listing row. On-chain tokenized stocks name the
 * company through `stock.subtitle`; a listing carries no `stock` and keeps the
 * name in `name` instead.
 */
export function getStockListingName(
  record: Pick<
    IMarketToken,
    'perpsCoin' | 'networkId' | 'stockId' | 'assetId' | 'name'
  >,
): string | undefined {
  if (getMarketWatchlistRowKind(record) !== 'stock') {
    return undefined;
  }
  return record.name.trim() || undefined;
}
