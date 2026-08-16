import { XStack, YStack } from '@onekeyhq/components';

import { MarketFiltersIconTrigger } from '../MarketFilterChipsBar';
import { MobileNetworkDropdown } from '../MobileNetworkDropdown';
import { TimeRangeDropdown } from '../TimeRangeDropdown';

import type { ITimeRangeSelectorValue } from '../TimeRangeSelector';

// Figma 25169-43731: the time-range dropdown and the filters trigger form one
// right-aligned group.
const TRAILING_CONTROLS_GAP = 10;

export interface IMarketFilterBarSmallProps {
  selectedNetworkId?: string;
  timeRange?: ITimeRangeSelectorValue;
  onNetworkIdChange?: (networkId: string) => void;
  onTimeRangeChange?: (value: ITimeRangeSelectorValue) => void;
}

function MarketFilterBarSmall({
  selectedNetworkId,
  timeRange = '1h',
  onNetworkIdChange,
  onTimeRangeChange,
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
        <XStack
          alignItems="center"
          justifyContent="flex-end"
          gap={TRAILING_CONTROLS_GAP}
        >
          {onTimeRangeChange ? (
            <TimeRangeDropdown
              value={timeRange}
              onChange={onTimeRangeChange}
              compact
            />
          ) : null}
          {onTimeRangeChange ? (
            <MarketFiltersIconTrigger
              timeRange={timeRange}
              onTimeRangeChange={onTimeRangeChange}
            />
          ) : null}
        </XStack>
      </XStack>
    </YStack>
  );
}

export { MarketFilterBarSmall };
