import { XStack, YStack } from '@onekeyhq/components';

import { MobileNetworkDropdown } from '../MobileNetworkDropdown';
import { TimeRangeDropdown } from '../TimeRangeDropdown';

import type { ITimeRangeSelectorValue } from '../TimeRangeSelector';

export interface IMarketFilterBarSmallProps {
  selectedNetworkId?: string;
  timeRange?: ITimeRangeSelectorValue;
  showNetworkSelector?: boolean;
  onNetworkIdChange?: (networkId: string) => void;
  onTimeRangeChange?: (value: ITimeRangeSelectorValue) => void;
}

function MarketFilterBarSmall({
  selectedNetworkId,
  timeRange = '1h',
  showNetworkSelector = true,
  onNetworkIdChange,
  onTimeRangeChange,
}: IMarketFilterBarSmallProps) {
  return (
    <YStack>
      {/* Both filters sit together on the left, so a tab without the network
          selector keeps its time range in the same place. */}
      <XStack
        px="$5"
        pt="$3"
        pb="$2"
        gap="$4"
        justifyContent="flex-start"
        alignItems="center"
      >
        <XStack display={showNetworkSelector ? 'flex' : 'none'}>
          <MobileNetworkDropdown
            selectedNetworkId={selectedNetworkId}
            onNetworkIdChange={onNetworkIdChange}
          />
        </XStack>
        {onTimeRangeChange ? (
          <TimeRangeDropdown
            value={timeRange}
            onChange={onTimeRangeChange}
            compact
          />
        ) : null}
      </XStack>
    </YStack>
  );
}

export { MarketFilterBarSmall };
