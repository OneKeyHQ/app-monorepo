import { useState } from 'react';

import { XStack, YStack } from '@onekeyhq/components';

import { LiquidityFilterControl } from '../LiquidityFilterControl';
import { MarketTokenListNetworkSelector } from '../MarketTokenListNetworkSelector';
import { TimeRangeSelector } from '../TimeRangeSelector';
import { WatchlistToggleButton } from '../WatchlistToggleButton';

import { MarketFilterBarSkeleton } from './MarketFilterBarSkeleton';

import type { ILiquidityFilter } from '../../types';
import type { ITimeRangeSelectorValue } from '../TimeRangeSelector';

export interface IMarketFilterBarProps {
  selectedNetworkId?: string;
  timeRange?: ITimeRangeSelectorValue;
  liquidityFilter?: ILiquidityFilter;
  showWatchlistOnly?: boolean;
  onNetworkIdChange?: (networkId: string) => void;
  onTimeRangeChange?: (value: ITimeRangeSelectorValue) => void;
  onLiquidityFilterChange?: (filter: ILiquidityFilter) => void;
  onWatchlistToggle: () => void;
  isLoading?: boolean;
}

export function MarketFilterBar({
  selectedNetworkId,
  timeRange = '24h',
  liquidityFilter,
  showWatchlistOnly = false,
  onNetworkIdChange,
  onTimeRangeChange,
  onLiquidityFilterChange,
  onWatchlistToggle,
  isLoading = false,
}: IMarketFilterBarProps) {
  const [currentTimeRange, setCurrentTimeRange] =
    useState<ITimeRangeSelectorValue>(timeRange);

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
    return <MarketFilterBarSkeleton />;
  }

  return (
    <YStack gap="$3">
      {/* Network Selector */}
      <MarketTokenListNetworkSelector
        selectedNetworkId={selectedNetworkId}
        onSelectNetworkId={handleNetworkIdChange}
        size="normal"
        forceLoading={isLoading}
      />

      <XStack gap="$3" pl="$5" pr="$5">
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

        {/* Watchlist Toggle Button */}
        <WatchlistToggleButton
          isActive={showWatchlistOnly}
          onToggle={onWatchlistToggle}
        />
      </XStack>
    </YStack>
  );
}
