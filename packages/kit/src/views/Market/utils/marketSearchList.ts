import { isMarketSearchStockListing } from '@onekeyhq/shared/src/utils/marketSearchStock';

export const MARKET_SEARCH_TABS = {
  all: 'all',
  tokens: 'tokens',
  stocks: 'stocks',
} as const;

export type IMarketSearchTab =
  (typeof MARKET_SEARCH_TABS)[keyof typeof MARKET_SEARCH_TABS];

export function getDetailPopoverSearchTabs(
  hasStockResults: boolean,
): IMarketSearchTab[] {
  if (hasStockResults) {
    return [
      MARKET_SEARCH_TABS.all,
      MARKET_SEARCH_TABS.stocks,
      MARKET_SEARCH_TABS.tokens,
    ];
  }
  return [MARKET_SEARCH_TABS.all, MARKET_SEARCH_TABS.tokens];
}

export function isDetailSearchChainToken(item: {
  stockId?: string;
  address?: string;
  network?: string;
  networkId?: string;
}): boolean {
  return !isMarketSearchStockListing({
    stockId: item.stockId,
    address: item.address,
    network: item.network ?? item.networkId,
  });
}
