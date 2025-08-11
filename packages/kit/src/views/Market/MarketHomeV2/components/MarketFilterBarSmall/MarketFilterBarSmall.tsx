import { Stack } from '@onekeyhq/components';

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

  // if (isLoading) {
  //   return null; // Could add skeleton later if needed
  // }

  return (
    <Stack px="$4">
      <MarketTokenListNetworkSelector
        selectedNetworkId={selectedNetworkId}
        onSelectNetworkId={handleNetworkIdChange}
        forceLoading={isLoading}
        placement="bottom-start"
      />
    </Stack>
  );
}

export { MarketFilterBarSmall };
