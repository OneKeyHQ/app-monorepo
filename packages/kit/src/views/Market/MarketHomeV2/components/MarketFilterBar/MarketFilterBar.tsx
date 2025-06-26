import { useState } from 'react';

import { XStack, YStack } from '@onekeyhq/components';

import { LiquidityFilterControl } from '../LiquidityFilterControl';
import { MarketTokenListNetworkSelector } from '../MarketTokenListNetworkSelector';
import { TimeRangeSelector } from '../TimeRangeSelector';

import { MarketFilterBarSkeleton } from './MarketFilterBarSkeleton';

import type { ILiquidityFilter } from '../../types';
import type { ITimeRangeSelectorValue } from '../TimeRangeSelector';

export interface IMarketFilterBarProps {
  selectedNetworkId?: string;
  timeRange?: ITimeRangeSelectorValue;
  liquidityFilter?: ILiquidityFilter;
  onNetworkIdChange?: (networkId: string) => void;
  onTimeRangeChange?: (value: ITimeRangeSelectorValue) => void;
  onLiquidityFilterChange?: (filter: ILiquidityFilter) => void;
  isLoading?: boolean;
}

export function MarketFilterBar({
  selectedNetworkId,
  timeRange = '24h',
  liquidityFilter,
  onNetworkIdChange,
  onTimeRangeChange,
  onLiquidityFilterChange,
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
      </XStack>
    </YStack>
  );
}
