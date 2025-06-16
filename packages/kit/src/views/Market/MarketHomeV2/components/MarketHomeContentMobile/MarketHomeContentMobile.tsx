import { MarketFilterBarSmall } from '../MarketFilterBarSmall';
import { MarketTokenList } from '../MarketTokenList';

import { MarketMobileTabs } from './MarketMobileTabs';

import type { ILiquidityFilter } from '../../types';
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
  activeTab: string;
  onTabChange: (tabId: string) => void;
}

export function MarketHomeContentMobile({
  filterBarProps,
  selectedNetworkId,
  liquidityFilter,
  activeTab,
  onTabChange,
}: IMarketHomeContentMobileProps) {
  return (
    <>
      <MarketMobileTabs selectedTab={activeTab} onTabChange={onTabChange} />

      {/* Static Content Below */}
      <MarketFilterBarSmall {...filterBarProps} />
      <MarketTokenList
        networkId={selectedNetworkId}
        liquidityFilter={liquidityFilter}
        defaultShowWatchlistOnly={activeTab === 'watchlist'}
        key={`${selectedNetworkId}-${activeTab}`} // Force re-render when tab changes
      />
    </>
  );
}
