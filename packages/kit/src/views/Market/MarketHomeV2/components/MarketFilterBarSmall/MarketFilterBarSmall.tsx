import { memo, useEffect, useState } from 'react';

import { XStack } from '@onekeyhq/components';

import { LiquidityFilterControl } from '../LiquidityFilterControl';
import { MarketTokenListNetworkSelector } from '../MarketTokenListNetworkSelector';
import { TimeRangeSelector } from '../TimeRangeSelector';

import type { ILiquidityFilter } from '../../types';
import type { ITimeRangeSelectorValue } from '../TimeRangeSelector';

export interface IMarketFilterBarSmallProps {
  selectedNetworkId?: string;
  timeRange?: ITimeRangeSelectorValue;
  liquidityFilter?: ILiquidityFilter;
  onNetworkIdChange?: (networkId: string) => void;
  onTimeRangeChange?: (value: ITimeRangeSelectorValue) => void;
  onLiquidityFilterChange?: (filter: ILiquidityFilter) => void;
  isLoading?: boolean;
}

function MarketFilterBarSmall({
  selectedNetworkId,
  timeRange = '5m',
  liquidityFilter,
  onNetworkIdChange,
  onTimeRangeChange,
  onLiquidityFilterChange,
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
    <XStack alignItems="center" gap="$3" px="$5" py="$3">
      {/* Network Selector */}
      <MarketTokenListNetworkSelector
        selectedNetworkId={selectedNetworkId}
        onSelectNetworkId={handleNetworkIdChange}
        size="small"
        forceLoading={isLoading}
        placement="bottom-start"
      />

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
