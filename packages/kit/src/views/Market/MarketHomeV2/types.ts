// Shared types for MarketHomeV2 components

export interface ILiquidityFilter {
  min?: string;
  max?: string;
}

// Tab related types for MarketHomeV2
export enum EMarketHomeTab {
  Watchlist = 'watchlist',
  Trending = 'trending',
}

export type IMarketHomeTabValue = `${EMarketHomeTab}`;

// Type guard to check if a string is a valid tab value
export function isValidMarketHomeTab(
  value: string,
): value is IMarketHomeTabValue {
  return Object.values(EMarketHomeTab).includes(value as EMarketHomeTab);
}
