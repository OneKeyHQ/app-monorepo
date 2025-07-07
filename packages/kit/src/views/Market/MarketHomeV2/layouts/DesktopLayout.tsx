import { useEffect, useState } from 'react';

import { useDebouncedCallback } from 'use-debounce';

import { Stack } from '@onekeyhq/components';

import { MarketFilterBar } from '../components/MarketFilterBar';
import { MarketFilterBarSmall } from '../components/MarketFilterBarSmall';
import { MarketTokenList } from '../components/MarketTokenList';
import { EMarketHomeTab } from '../types';

import type { ITimeRangeSelectorValue } from '../components/TimeRangeSelector';
import type { ILiquidityFilter, IMarketHomeTabValue } from '../types';

interface IDesktopLayoutProps {
  filterBarProps: {
    selectedNetworkId: string;
    timeRange: ITimeRangeSelectorValue;
    liquidityFilter: ILiquidityFilter;
    showWatchlistOnly: boolean;
    onNetworkIdChange: (networkId: string) => void;
    onTimeRangeChange: (timeRange: ITimeRangeSelectorValue) => void;
    onLiquidityFilterChange: (filter: ILiquidityFilter) => void;
    onWatchlistToggle: () => void;
  };
  selectedNetworkId: string;
  liquidityFilter: ILiquidityFilter;
  activeTab: IMarketHomeTabValue;
}

export function DesktopLayout({
  filterBarProps,
  selectedNetworkId,
  liquidityFilter,
  activeTab,
}: IDesktopLayoutProps) {
  const [showSmallBar, setShowSmallBar] = useState(false);

  // Use a debounced callback to avoid excessive state updates during fast scroll events
  const handleScrollOffsetChange = useDebouncedCallback((offsetY: number) => {
    setShowSmallBar(offsetY > 20);
  }, 50);

  useEffect(() => {
    setShowSmallBar(false);
  }, [selectedNetworkId]);

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
          top={showSmallBar ? 0 : -50}
          left={0}
          right={0}
          zIndex={100}
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
          externalWatchlistControl={{
            showWatchlistOnly: filterBarProps.showWatchlistOnly,
            onToggle: filterBarProps.onWatchlistToggle,
          }}
          key={`${selectedNetworkId}-${activeTab}`} // Force re-render when tab changes
        />
      </Stack>
    </>
  );
}
