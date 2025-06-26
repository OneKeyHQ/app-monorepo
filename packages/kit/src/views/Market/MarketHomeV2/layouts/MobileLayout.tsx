import { Stack } from '@onekeyhq/components';

import { MarketMobileTabs } from '../components/MarketHomeContentMobile/MarketMobileTabs';

import type { ITimeRangeSelectorValue } from '../components/TimeRangeSelector';
import type { ILiquidityFilter, IMarketHomeTabValue } from '../types';

interface IMobileLayoutProps {
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

export function MobileLayout({
  filterBarProps,
  selectedNetworkId,
  liquidityFilter,
  activeTab,
  onTabChange,
}: IMobileLayoutProps) {
  return (
    <Stack flex={1}>
      <MarketMobileTabs
        selectedTab={activeTab}
        onTabChange={onTabChange}
        filterBarProps={filterBarProps}
        selectedNetworkId={selectedNetworkId}
        liquidityFilter={liquidityFilter}
      />
    </Stack>
  );
}
