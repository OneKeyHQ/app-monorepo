import { useState } from 'react';

import { XStack } from '@onekeyhq/components';

import { LiquidityFilterControl } from '../LiquidityFilterControl';
import { TimeRangeSelector } from '../TimeRangeSelector';

import { MarketFilterBarSkeleton } from './MarketFilterBarSkeleton';

import type { ILiquidityFilter } from '../../types';
import type { ITimeRangeSelectorValue } from '../TimeRangeSelector';

export interface IMarketFilterBarProps {
  liquidityFilter?: ILiquidityFilter;
  onLiquidityFilterChange?: (filter: ILiquidityFilter) => void;
  isLoading?: boolean;
}

export function MarketFilterBar({
  liquidityFilter,
  onLiquidityFilterChange,
  isLoading = false,
}: IMarketFilterBarProps) {
  const [timeRange, setTimeRange] = useState<ITimeRangeSelectorValue>('24h');

  const handleTimeRangeChange = (value: ITimeRangeSelectorValue) => {
    setTimeRange(value);
  };

  const handleLiquidityFilterApply = (filter: ILiquidityFilter) => {
    onLiquidityFilterChange?.(filter);
  };

  if (isLoading) {
    return <MarketFilterBarSkeleton />;
  }

  return (
    <XStack alignItems="center" gap="$3">
      <TimeRangeSelector value={timeRange} onChange={handleTimeRangeChange} />

      <LiquidityFilterControl
        value={liquidityFilter}
        onApply={handleLiquidityFilterApply}
      />
    </XStack>
  );
}
