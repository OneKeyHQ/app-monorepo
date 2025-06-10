import { useState } from 'react';

import { View } from 'react-native';

import { XStack } from '@onekeyhq/components';

import { LiquidityFilterControl } from '../LiquidityFilterControl';
import { TimeRangeSelector } from '../TimeRangeSelector';

import type { ILiquidityFilter } from '../../types';
import type { ITimeRangeSelectorValue } from '../TimeRangeSelector';

interface IMarketFilterBarProps {
  liquidityFilter?: ILiquidityFilter;
  onLiquidityFilterChange?: (filter: ILiquidityFilter) => void;
}

export function MarketFilterBar({
  liquidityFilter,
  onLiquidityFilterChange,
}: IMarketFilterBarProps) {
  const [timeRange, setTimeRange] = useState<ITimeRangeSelectorValue>('24h');

  const handleTimeRangeChange = (value: ITimeRangeSelectorValue) => {
    setTimeRange(value);
  };

  const handleLiquidityFilterApply = (filter: ILiquidityFilter) => {
    onLiquidityFilterChange?.(filter);
  };

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
