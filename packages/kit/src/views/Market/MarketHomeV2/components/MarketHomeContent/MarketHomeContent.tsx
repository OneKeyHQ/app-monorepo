import { useCallback, useState } from 'react';

import { Stack } from '@onekeyhq/components';

import { EMarketHomeTab } from '../../types';
import { MarketFilterBar } from '../MarketFilterBar';
import { MarketFilterBarSmall } from '../MarketFilterBarSmall';
import { MarketTokenList } from '../MarketTokenList';

import type { ILiquidityFilter, IMarketHomeTabValue } from '../../types';
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
  activeTab: IMarketHomeTabValue;
}

export function MarketHomeContent({
  filterBarProps,
  selectedNetworkId,
  liquidityFilter,
  activeTab,
}: IMarketHomeContentProps) {
  const [showSmallBar, setShowSmallBar] = useState(false);

  const handleScrollOffsetChange = useCallback((offsetY: number) => {
    setShowSmallBar(offsetY > 50);
  }, []);

  return (
    <>
      <Stack>
        {/* Normal (large) filter bar shown when list is at top */}
        <Stack
          opacity={showSmallBar ? 0 : 1}
          height={showSmallBar ? 50 : 120}
          animation="quick"
        >
          <MarketFilterBar {...filterBarProps} />
        </Stack>

        <Stack
          position="absolute"
          top={showSmallBar ? -50 : 0}
          left={0}
          right={0}
          zIndex={1000}
          opacity={showSmallBar ? 1 : 0}
          pointerEvents={showSmallBar ? 'auto' : 'none'}
          animation="quick"
        >
          <MarketFilterBarSmall {...filterBarProps} />
        </Stack>
      </Stack>

      <Stack px="$5" flex={1}>
        <MarketTokenList
          networkId={selectedNetworkId}
          liquidityFilter={liquidityFilter}
          onScrollOffsetChange={handleScrollOffsetChange}
          defaultShowWatchlistOnly={activeTab === EMarketHomeTab.Watchlist}
          key={`${selectedNetworkId}-${activeTab}`} // Force re-render when tab changes
        />
      </Stack>
    </>
  );
}
