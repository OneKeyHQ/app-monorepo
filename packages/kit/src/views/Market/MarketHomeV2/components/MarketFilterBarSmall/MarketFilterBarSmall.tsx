import { XStack } from '@onekeyhq/components';

import { MarketTokenListNetworkSelector } from '../MarketTokenListNetworkSelector';

import type { ILiquidityFilter } from '../../types';
import type { ITimeRangeSelectorValue } from '../TimeRangeSelector';

export interface IMarketFilterBarSmallProps {
  selectedNetworkId?: string;
  timeRange?: ITimeRangeSelectorValue;
  liquidityFilter?: ILiquidityFilter;
  onNetworkIdChange?: (networkId: string) => void;
  onTimeRangeChange?: (value: ITimeRangeSelectorValue) => void;
  onLiquidityFilterChange?: (filter: ILiquidityFilter) => void;
  isLoading?: boolean;
}

function MarketFilterBarSmall({
  selectedNetworkId,
  onNetworkIdChange,
  isLoading = false,
}: IMarketFilterBarSmallProps) {
  const handleNetworkIdChange = (networkId: string) => {
    onNetworkIdChange?.(networkId);
  };

  if (isLoading) {
    return null; // Could add skeleton later if needed
  }

  return (
    <XStack alignItems="center" gap="$6" pl="$5" pr="$5" py="$3">
      {/* Network Selector */}
      <MarketTokenListNetworkSelector
        selectedNetworkId={selectedNetworkId}
        onSelectNetworkId={handleNetworkIdChange}
        size="small"
        forceLoading={isLoading}
        placement="bottom-start"
      />
    </XStack>
  );
}

export { MarketFilterBarSmall };
