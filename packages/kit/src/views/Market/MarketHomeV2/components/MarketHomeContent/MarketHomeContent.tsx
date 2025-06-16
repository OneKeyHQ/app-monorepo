import { useCallback, useState } from 'react';

import { Stack } from '@onekeyhq/components';

import { MarketFilterBar } from '../MarketFilterBar';
import { MarketFilterBarSmall } from '../MarketFilterBarSmall';
import { MarketTokenList } from '../MarketTokenList';

import type { ILiquidityFilter } from '../../types';
import type { ITimeRangeSelectorValue } from '../TimeRangeSelector';

interface IMarketHomeContentProps {
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

export function MarketHomeContent({
  filterBarProps,
  selectedNetworkId,
  liquidityFilter,
  activeTab,
  onTabChange,
}: IMarketHomeContentProps) {
  // Show compact filter bar after user scrolls past the initial large bar.
  const [showSmallBar, setShowSmallBar] = useState(false);

  const handleScrollOffsetChange = useCallback((offsetY: number) => {
    // Threshold can be tweaked; 100px works well for desktop list.
    setShowSmallBar(offsetY > 10);
  }, []);

  return (
    <>
      <Stack>
        {/* Normal (large) filter bar shown when list is at top */}
        <MarketFilterBar {...filterBarProps} />

        {showSmallBar ? (
          <Stack
            position="absolute"
            bottom={0}
            left={0}
            right={0}
            zIndex={1000}
          >
            <MarketFilterBarSmall {...filterBarProps} />
          </Stack>
        ) : undefined}
      </Stack>

      <MarketTokenList
        networkId={selectedNetworkId}
        liquidityFilter={liquidityFilter}
        onScrollOffsetChange={handleScrollOffsetChange}
        defaultShowWatchlistOnly={activeTab === 'watchlist'}
        key={`${selectedNetworkId}-${activeTab}`} // Force re-render when tab changes
      />
    </>
  );
}
