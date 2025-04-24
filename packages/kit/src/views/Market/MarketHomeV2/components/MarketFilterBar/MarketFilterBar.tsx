import { useState } from 'react';

import { View } from 'react-native';

import { Stack } from '@onekeyhq/components';

import { TimeRangeSelector } from '../TimeRangeSelector';

type ITimeRangeSelectorValue = '5m' | '1h' | '4h' | '24h';

export function MarketFilterBar() {
  const [timeRange, setTimeRange] = useState<ITimeRangeSelectorValue>('24h');

  const handleTimeRangeChange = (value: ITimeRangeSelectorValue) => {
    setTimeRange(value);
  };

  return (
    <View>
      <Stack alignItems="center">
        <TimeRangeSelector value={timeRange} onChange={handleTimeRangeChange} />
      </Stack>
    </View>
  );
}
