import { MARKET_TOP_COINS_CATEGORY_ID } from '@onekeyhq/shared/src/consts/marketConsts';

export type IMarketMobileDetailKind = 'trending' | 'topCoin' | 'stock';

export type IMarketDetailFooterMode = 'buy-sell' | 'perps-buy-sell';

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
  hasPerps: boolean,
): IMarketDetailFooterMode {
  return hasPerps ? 'perps-buy-sell' : 'buy-sell';
}

export type IMobileInformationColumnHeader =
  | 'transactions'
  | 'portfolio'
  | 'holders'
  | 'none';

// The sticky column header belongs to a table tab. Match the tab title, not
// "whatever is first": mobile trending opens on Overview, while desktop still
// opens on the transactions table.
export function resolveMobileInformationColumnHeader({
  detailKind,
  focusedTab,
  transactionsTabName,
  holdersTabName,
  portfolioTabName,
  liquidityTabName,
}: {
  detailKind: IMarketMobileDetailKind;
  focusedTab: string;
  transactionsTabName: string;
  holdersTabName: string;
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
  if (focusedTab === transactionsTabName) {
    return 'transactions';
  }
  if (focusedTab === holdersTabName) {
    return 'holders';
  }
  return 'none';
}
