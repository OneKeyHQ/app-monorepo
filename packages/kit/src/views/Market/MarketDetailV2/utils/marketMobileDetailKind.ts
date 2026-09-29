import { MARKET_TOP_COINS_CATEGORY_ID } from '@onekeyhq/shared/src/consts/marketConsts';

export type IMarketMobileDetailKind = 'trending' | 'topCoin' | 'stock';

export type IMarketDetailFooterMode = 'trade' | 'perps-trade';

export type IMarketMobileTradeDestination = 'stock' | 'swap';

// Stocks open the stock tab. Mainstream coins, trending tokens, and Robinhood
// all open ordinary Swap. None of these market trades open Pro.
export function resolveMarketMobileTradeDestination(
  kind: IMarketMobileDetailKind,
): IMarketMobileTradeDestination {
  if (kind === 'stock') {
    return 'stock';
  }
  return 'swap';
}

export function resolveMarketMobileDetailKind({
  isStockToken,
  marketTokenCategory,
}: {
  isStockToken: boolean;
  marketTokenCategory?: string;
}): IMarketMobileDetailKind {
  if (isStockToken) {
    return 'stock';
  }
  if (marketTokenCategory === MARKET_TOP_COINS_CATEGORY_ID) {
    return 'topCoin';
  }
  return 'trending';
}

export function resolveMarketDetailFooterMode(
  kind: IMarketMobileDetailKind,
): IMarketDetailFooterMode {
  return kind === 'trending' ? 'trade' : 'perps-trade';
}

export type IMobileInformationColumnHeader =
  | 'transactions'
  | 'portfolio'
  | 'holders'
  | 'none';

// The sticky column header belongs to a table tab. Stock and top-coin
// overviews are stat grids, so they keep the tab bar and nothing under it.
export function resolveMobileInformationColumnHeader({
  detailKind,
  focusedTab,
  firstTabName,
  portfolioTabName,
  liquidityTabName,
}: {
  detailKind: IMarketMobileDetailKind;
  focusedTab: string;
  firstTabName: string;
  portfolioTabName: string;
  liquidityTabName: string;
}): IMobileInformationColumnHeader {
  if (focusedTab === portfolioTabName) {
    return 'portfolio';
  }
  if (focusedTab === liquidityTabName) {
    return 'none';
  }
  if (detailKind === 'stock' || detailKind === 'topCoin') {
    return 'none';
  }
  if (focusedTab !== firstTabName) {
    return 'holders';
  }
  return 'transactions';
}
