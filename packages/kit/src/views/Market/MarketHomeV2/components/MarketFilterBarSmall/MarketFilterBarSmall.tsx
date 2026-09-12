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
      <XStack
        px="$5"
        pt="$3"
        pb="$2"
        justifyContent={showNetworkSelector ? 'space-between' : 'flex-end'}
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
