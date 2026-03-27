import { XStack, YStack } from '@onekeyhq/components';

import { CategorySelector } from '../CategorySelector';
import { MobileNetworkDropdown } from '../MobileNetworkDropdown';
import { TimeRangeDropdown } from '../TimeRangeDropdown';

import type { IMarketCategoryItem } from '../../types';
import type { ITimeRangeSelectorValue } from '../TimeRangeSelector';

export interface IMarketFilterBarSmallProps {
  selectedNetworkId?: string;
  timeRange?: ITimeRangeSelectorValue;
  onNetworkIdChange?: (networkId: string) => void;
  onTimeRangeChange?: (value: ITimeRangeSelectorValue) => void;
  selectedCategory?: string;
  categories?: IMarketCategoryItem[];
  onCategoryChange?: (categoryId: string) => void;
}

function MarketFilterBarSmall({
  selectedNetworkId,
  timeRange = '24h',
  onNetworkIdChange,
  onTimeRangeChange,
  selectedCategory,
  categories = [],
  onCategoryChange,
}: IMarketFilterBarSmallProps) {
  return (
    <YStack>
      <XStack
        px="$5"
        pt="$3"
        pb="$2"
        justifyContent="space-between"
        alignItems="center"
      >
        <MobileNetworkDropdown
          selectedNetworkId={selectedNetworkId}
          onNetworkIdChange={onNetworkIdChange}
        />
        {onTimeRangeChange ? (
          <TimeRangeDropdown
            value={timeRange}
            onChange={onTimeRangeChange}
            compact
          />
        ) : null}
      </XStack>

      {categories.length > 0 && onCategoryChange ? (
        <CategorySelector
          categories={categories}
          selectedCategoryId={selectedCategory ?? 'trending'}
          onSelectCategory={onCategoryChange}
        />
      ) : null}
    </YStack>
  );
}

export { MarketFilterBarSmall };
