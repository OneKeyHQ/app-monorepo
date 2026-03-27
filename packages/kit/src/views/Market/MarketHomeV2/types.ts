// Shared types for MarketHomeV2 components

import type { IKeyOfIcons } from '@onekeyhq/components';

export interface ILiquidityFilter {
  min?: string;
  max?: string;
}

// Tab related types for MarketHomeV2
export enum EMarketHomeTab {
  Watchlist = 'watchlist',
  Trending = 'trending',
  Perps = 'perps',
}

export type IMarketHomeTabValue = `${EMarketHomeTab}`;

// Type guard to check if a string is a valid tab value
export function isValidMarketHomeTab(
  value: string,
): value is IMarketHomeTabValue {
  return Object.values(EMarketHomeTab).includes(value as EMarketHomeTab);
}

export type IMarketApiTimeFrame = '1' | '2' | '3' | '4'; // 1=5m, 2=1h, 3=4h, 4=24h

export interface IMarketCategoryItem {
  id: string;
  name: string;
  icon?: IKeyOfIcons;
}

// Map UI time range values to API timeFrame values
export const TIME_RANGE_TO_API_MAP: Record<string, IMarketApiTimeFrame> = {
  '5m': '1',
  '1h': '2',
  '4h': '3',
  '24h': '4',
};

// Time range selector value type (same as ITimeRangeSelectorValue)
export type IMarketTimeRangeValue = '5m' | '1h' | '4h' | '24h';

// Shared filter bar props interface used by Desktop/Mobile layouts
export interface IMarketFilterBarProps {
  selectedNetworkId: string;
  timeRange: IMarketTimeRangeValue;
  liquidityFilter?: ILiquidityFilter;
  onNetworkIdChange: (networkId: string) => void;
  onTimeRangeChange: (timeRange: IMarketTimeRangeValue) => void;
  onLiquidityFilterChange?: (filter: ILiquidityFilter) => void;
  selectedCategory?: string;
  categories?: IMarketCategoryItem[];
  onCategoryChange?: (categoryId: string) => void;
}
