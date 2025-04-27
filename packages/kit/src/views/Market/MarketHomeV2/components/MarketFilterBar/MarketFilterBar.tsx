import { useState } from 'react';

import { View } from 'react-native';

import { XStack } from '@onekeyhq/components';

import {
  DiscoveryFilterControl,
  EFilterOption,
} from '../DiscoveryFilterControl';
import { LiquidityFilterControl } from '../LiquidityFilterControl';
import { TimeRangeSelector } from '../TimeRangeSelector';

import FilterButton from './FilterButton';

import type { ITimeRangeSelectorValue } from '../TimeRangeSelector';

export function MarketFilterBar() {
  const [timeRange, setTimeRange] = useState<ITimeRangeSelectorValue>('24h');
  const [filterOption, setFilterOption] = useState<EFilterOption>(
    EFilterOption.Trending,
  );

  const handleTimeRangeChange = (value: ITimeRangeSelectorValue) => {
    setTimeRange(value);
  };

  const handleFilterOptionChange = (value: EFilterOption) => {
    setFilterOption(value);
  };

  return (
    <View>
      <XStack alignItems="center" gap="$3">
        <TimeRangeSelector value={timeRange} onChange={handleTimeRangeChange} />

        <DiscoveryFilterControl
          value={filterOption}
          onChange={handleFilterOptionChange}
        />

        <LiquidityFilterControl />

        <FilterButton />
      </XStack>
    </View>
  );
}
