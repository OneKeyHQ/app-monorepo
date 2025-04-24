import { useState } from 'react';

import { View } from 'react-native';

import { XStack } from '@onekeyhq/components';

import {
  DiscoveryFilterControl,
  EFilterOption,
} from '../DiscoveryFilterControl';
import { TimeRangeSelector } from '../TimeRangeSelector';

type ITimeRangeSelectorValue = '5m' | '1h' | '4h' | '24h';

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
      </XStack>
    </View>
  );
}
