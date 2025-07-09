import { Stack } from '@onekeyhq/components';

import { MarketFilterBar } from '../components/MarketFilterBar';
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
  return (
    <>
      <Stack>
        <MarketFilterBar {...filterBarProps} />
      </Stack>

      <Stack px="$5" flex={1}>
        <MarketTokenList
          networkId={selectedNetworkId}
          liquidityFilter={liquidityFilter}
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
