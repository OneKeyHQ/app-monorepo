import { memo, useEffect, useState } from 'react';

import { XStack } from '@onekeyhq/components';

import { LiquidityFilterControl } from '../LiquidityFilterControl';
import { MarketTokenListNetworkSelector } from '../MarketTokenListNetworkSelector';
import { MarketViewToggle } from '../MarketViewToggle';
import { TimeRangeSelector } from '../TimeRangeSelector';

import type { ILiquidityFilter } from '../../types';
import type { ITimeRangeSelectorValue } from '../TimeRangeSelector';

export interface IMarketFilterBarSmallProps {
  selectedNetworkId?: string;
  timeRange?: ITimeRangeSelectorValue;
  liquidityFilter?: ILiquidityFilter;
  showWatchlistOnly?: boolean;
  onNetworkIdChange?: (networkId: string) => void;
  onTimeRangeChange?: (value: ITimeRangeSelectorValue) => void;
  onLiquidityFilterChange?: (filter: ILiquidityFilter) => void;
  onWatchlistToggle?: () => void;
  isLoading?: boolean;
}

function MarketFilterBarSmall({
  selectedNetworkId,
  timeRange = '5m',
  liquidityFilter,
  showWatchlistOnly = false,
  onNetworkIdChange,
  onTimeRangeChange,
  onLiquidityFilterChange,
  onWatchlistToggle,
  isLoading = false,
}: IMarketFilterBarSmallProps) {
  const [currentTimeRange, setCurrentTimeRange] =
    useState<ITimeRangeSelectorValue>(timeRange);

  // Sync with external timeRange prop
  useEffect(() => {
    setCurrentTimeRange(timeRange);
  }, [timeRange]);

  const handleTimeRangeChange = (value: ITimeRangeSelectorValue) => {
    setCurrentTimeRange(value);
    onTimeRangeChange?.(value);
  };

  const handleLiquidityFilterApply = (filter: ILiquidityFilter) => {
    onLiquidityFilterChange?.(filter);
  };

  const handleNetworkIdChange = (networkId: string) => {
    onNetworkIdChange?.(networkId);
  };

  if (isLoading) {
    return null; // Could add skeleton later if needed
  }

  return (
    <XStack alignItems="center" gap="$6" pl="$7" pr="$5" py="$3">
      {/* Network Selector */}
      <MarketTokenListNetworkSelector
        selectedNetworkId={selectedNetworkId}
        onSelectNetworkId={handleNetworkIdChange}
        size="small"
        forceLoading={isLoading}
        placement="bottom-start"
      />

      <XStack gap="$4">
        {/* Market View Toggle - Trending and Watchlist buttons */}
        <MarketViewToggle
          showWatchlistOnly={showWatchlistOnly}
          onToggle={onWatchlistToggle ?? (() => {})}
        />
      </XStack>

      {/* Time Range Selector */}
      <TimeRangeSelector
        value={currentTimeRange}
        onChange={handleTimeRangeChange}
      />

      {/* Liquidity Filter */}
      <LiquidityFilterControl
        value={liquidityFilter}
        onApply={handleLiquidityFilterApply}
      />
    </XStack>
  );
}

export { MarketFilterBarSmall };
