import { getMarketWatchlistKey } from '@onekeyhq/shared/src/utils/marketWatchlistIdentity';
import type { IMarketWatchListItemV2 } from '@onekeyhq/shared/types/market';

import {
  getNativeTokenInfo,
  getNetworkLogoUri,
} from '../utils/tokenListHelpers';

import { getWatchlistListingPreview } from './watchlistListingPreview';

import type { IMarketToken } from '../MarketTokenData';

const PENDING_WATCHLIST_METRICS = {
  decimals: 0,
  price: Number.NaN,
  change24h: Number.NaN,
  priceChangeRaw: '-',
  marketCap: Number.NaN,
  liquidity: 0,
  transactions: 0,
  uniqueTraders: 0,
  holders: 0,
  turnover: Number.NaN,
  isPendingWatchlistRow: true,
} as const;

export function shouldEmitNativePendingWatchlistRow({
  isNative,
  hasQuotesInFlight,
  hasQuotePayload,
  quotesFailed,
  hasCachedRows,
}: {
  isNative: boolean;
  hasQuotesInFlight: boolean;
  hasQuotePayload: boolean;
  quotesFailed: boolean;
  hasCachedRows: boolean;
}): boolean {
  if (!isNative || quotesFailed || !hasQuotesInFlight) {
    return false;
  }
  if (!hasQuotePayload) {
    return true;
  }
  return hasCachedRows;
}

export function buildPendingSpotWatchlistToken(
  watchlistItem: IMarketWatchListItemV2,
  networkLogoUriMap: ReadonlyMap<string, string>,
): IMarketToken {
  const { isNative } = getNativeTokenInfo(
    watchlistItem.isNative,
    watchlistItem.contractAddress,
  );
  const preview = getWatchlistListingPreview(watchlistItem);
  const chainId = watchlistItem.chainId;
  return {
    ...PENDING_WATCHLIST_METRICS,
    id: getMarketWatchlistKey(watchlistItem),
    name: preview?.name ?? '',
    symbol: preview?.symbol ?? '',
    address: isNative ? '' : (watchlistItem.contractAddress ?? ''),
    tokenImageUri: preview?.logoUrl ?? '',
    networkLogoUri:
      networkLogoUriMap.get(chainId) || getNetworkLogoUri(chainId),
    networkId: chainId,
    chainId,
    sortIndex: watchlistItem.sortIndex ?? 0,
    isNative,
  };
}

export function buildPendingPerpsWatchlistToken(
  watchlistItem: IMarketWatchListItemV2,
): IMarketToken {
  const coin = watchlistItem.perpsCoin ?? '';
  return {
    ...PENDING_WATCHLIST_METRICS,
    id: `perps_${coin}`,
    name: coin,
    symbol: coin,
    address: '',
    tokenImageUri: '',
    networkLogoUri: '',
    networkId: '',
    chainId: '',
    sortIndex: watchlistItem.sortIndex ?? 0,
    perpsCoin: coin,
  };
}
