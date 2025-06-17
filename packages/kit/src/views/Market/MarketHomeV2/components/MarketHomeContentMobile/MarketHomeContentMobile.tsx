import { useCallback } from 'react';

import { Stack } from '@onekeyhq/components';

import { MarketFilterBarSmall } from '../MarketFilterBarSmall';
import { MarketTokenList } from '../MarketTokenList';

import { MarketMobileTabs } from './MarketMobileTabs';

import type { ILiquidityFilter, IMarketHomeTabValue } from '../../types';
import type { ITimeRangeSelectorValue } from '../TimeRangeSelector';

interface IMarketHomeContentMobileProps {
  filterBarProps: {
    selectedNetworkId: string;
    timeRange: ITimeRangeSelectorValue;
    liquidityFilter: ILiquidityFilter;
    onNetworkIdChange: (networkId: string) => void;
    onTimeRangeChange: (timeRange: ITimeRangeSelectorValue) => void;
    onLiquidityFilterChange: (filter: ILiquidityFilter) => void;
  };
  selectedNetworkId: string;
  liquidityFilter: ILiquidityFilter;
  activeTab: IMarketHomeTabValue;
  onTabChange: (tabId: IMarketHomeTabValue) => void;
}

export function MarketHomeContentMobile({
  filterBarProps,
  selectedNetworkId,
  liquidityFilter,
  activeTab,
  onTabChange,
}: IMarketHomeContentMobileProps) {
  const WatchlistPageComponent = useCallback(
    () => (
      <Stack flex={1}>
        <MarketTokenList
          networkId={selectedNetworkId}
          liquidityFilter={liquidityFilter}
          defaultShowWatchlistOnly
        />
      </Stack>
    ),
    [selectedNetworkId, liquidityFilter],
  );

  const TrendingPageComponent = useCallback(
    () => (
      <Stack flex={1}>
        <MarketFilterBarSmall {...filterBarProps} />
        <MarketTokenList
          networkId={selectedNetworkId}
          liquidityFilter={liquidityFilter}
          defaultShowWatchlistOnly={false}
        />
      </Stack>
    ),
    [filterBarProps, selectedNetworkId, liquidityFilter],
  );

  return (
    <MarketMobileTabs
      selectedTab={activeTab}
      onTabChange={onTabChange}
      watchlistContent={WatchlistPageComponent}
      trendingContent={TrendingPageComponent}
    />
  );
}
