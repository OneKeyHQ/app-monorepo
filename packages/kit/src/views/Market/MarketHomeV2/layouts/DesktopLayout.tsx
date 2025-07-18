import { Stack } from '@onekeyhq/components';
import {
  useMarketWatchListV2Atom,
  useShowWatchlistOnlyValue,
} from '@onekeyhq/kit/src/states/jotai/contexts/marketV2';

import { MarketFilterBar } from '../components/MarketFilterBar';
import {
  MarketRecommendList,
  mockRecommendedTokens,
} from '../components/MarketRecommendList';
import { MarketTokenList } from '../components/MarketTokenList';

import type { ITimeRangeSelectorValue } from '../components/TimeRangeSelector';
import type { ILiquidityFilter, IMarketHomeTabValue } from '../types';

interface IDesktopLayoutProps {
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

export function DesktopLayout({
  filterBarProps,
  selectedNetworkId,
  liquidityFilter,
  activeTab,
}: IDesktopLayoutProps) {
  const [watchlistState] = useMarketWatchListV2Atom();
  const [showWatchlistOnly] = useShowWatchlistOnlyValue();

  const watchlistItems = watchlistState.data;
  const isWatchlistEmpty = !watchlistItems || watchlistItems.length === 0;
  const shouldShowRecommendList = showWatchlistOnly && isWatchlistEmpty;

  return (
    <>
      <Stack>
        <MarketFilterBar {...filterBarProps} />
      </Stack>

      {shouldShowRecommendList ? (
        <Stack
          position="absolute"
          bottom={0}
          top="20vh"
          left={0}
          right={0}
          zIndex={1000}
        >
          <MarketRecommendList
            recommendedTokens={mockRecommendedTokens}
            maxSize={8}
            enableSelection
            showTitle
            showAddButton
            networkId={selectedNetworkId}
          />
        </Stack>
      ) : (
        <Stack px="$5" flex={1}>
          <MarketTokenList
            networkId={selectedNetworkId}
            liquidityFilter={liquidityFilter}
            key={`${selectedNetworkId}-${activeTab}`} // Force re-render when tab changes
          />
        </Stack>
      )}
    </>
  );
}
