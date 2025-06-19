import { Stack } from '@onekeyhq/components';

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
