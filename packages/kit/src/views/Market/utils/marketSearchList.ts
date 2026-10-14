import { isMarketSearchStockListing } from '@onekeyhq/shared/src/utils/marketSearchStock';

export const MARKET_SEARCH_TABS = {
  all: 'all',
  tokens: 'tokens',
  stocks: 'stocks',
} as const;

export type IMarketSearchTab =
  (typeof MARKET_SEARCH_TABS)[keyof typeof MARKET_SEARCH_TABS];

/**
 * A type tab shows only when it has results; All is always first. Pass
 * `hasTokenResults` as true while tokens are still loading so the tab does not
 * flicker away and back.
 */
export function getDetailPopoverSearchTabs(
  hasStockResults: boolean,
  hasTokenResults = true,
): IMarketSearchTab[] {
  const tabs: IMarketSearchTab[] = [MARKET_SEARCH_TABS.all];
  if (hasStockResults) {
    tabs.push(MARKET_SEARCH_TABS.stocks);
  }
  if (hasTokenResults) {
    tabs.push(MARKET_SEARCH_TABS.tokens);
  }
  return tabs;
}

export function isDetailSearchChainToken(item: {
  stockId?: string;
  address?: string;
  network?: string;
  networkId?: string;
}): boolean {
  return !isMarketSearchStockListing({
    stockId: item.stockId,
    address: item.address ?? '',
    network: item.network ?? item.networkId ?? '',
  });
}
