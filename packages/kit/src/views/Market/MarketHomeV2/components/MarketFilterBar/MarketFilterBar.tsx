import { useState } from 'react';

import { View } from 'react-native';

import { Dialog, XStack } from '@onekeyhq/components';

import {
  DiscoveryFilterControl,
  EFilterOption,
} from '../DiscoveryFilterControl';
import { LiquidityFilterControl } from '../LiquidityFilterControl';
import { TimeRangeSelector } from '../TimeRangeSelector';

import CustomFiltersDialog from './CustomFiltersDialog';
import FilterButton from './FilterButton';

import type { IFilterOptions } from './CustomFiltersDialog';
import type { ITimeRangeSelectorValue } from '../TimeRangeSelector';

export function MarketFilterBar() {
  const [timeRange, setTimeRange] = useState<ITimeRangeSelectorValue>('24h');
  const [filterOption, setFilterOption] = useState<EFilterOption>(
    EFilterOption.Trending,
  );
  const [, setCustomFilters] = useState<IFilterOptions | null>(null);

  const handleTimeRangeChange = (value: ITimeRangeSelectorValue) => {
    setTimeRange(value);
  };

  const handleFilterOptionChange = (value: EFilterOption) => {
    setFilterOption(value);
  };

  const handleOpenDialog = () => {
    const dialog = Dialog.show({
      title: 'Custom Filters',
      showFooter: false,
      renderContent: (
        <CustomFiltersDialog
          onClose={() => {
            void dialog.close();
          }}
          onApply={(filters) => {
            setCustomFilters(filters);
            void dialog.close();
          }}
        />
      ),
    });
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

        <FilterButton onPress={handleOpenDialog} />
      </XStack>
    </View>
  );
}
