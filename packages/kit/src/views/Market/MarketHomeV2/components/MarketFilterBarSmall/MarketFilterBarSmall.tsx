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
}

function MarketFilterBarSmall({
  selectedNetworkId,
  onNetworkIdChange,
}: IMarketFilterBarSmallProps) {
  const handleNetworkIdChange = (networkId: string) => {
    onNetworkIdChange?.(networkId);
  };

  return (
    <MarketTokenListNetworkSelector
      selectedNetworkId={selectedNetworkId}
      onSelectNetworkId={handleNetworkIdChange}
      placement="bottom-start"
      containerStyle={{
        px: '$4',
        pt: '$3',
        pb: '$2',
      }}
    />
  );
}

export { MarketFilterBarSmall };
