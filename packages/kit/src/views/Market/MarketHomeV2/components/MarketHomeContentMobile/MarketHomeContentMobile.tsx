import { useState } from 'react';

import { MarketFilterBarSmall } from '../MarketFilterBarSmall';
import { MarketTokenList } from '../MarketTokenList';

import type { ILiquidityFilter } from '../../types';
import type { ITimeRangeSelectorValue } from '../TimeRangeSelector';

export function MarketHomeContentMobile() {
  const [selectedNetworkId, setSelectedNetworkId] =
    useState<string>('sol--101'); // 默认选择 Solana
  const [liquidityFilter, setLiquidityFilter] = useState<ILiquidityFilter>({});
  const [timeRange, setTimeRange] = useState<ITimeRangeSelectorValue>('5m');

  const filterBarProps = {
    selectedNetworkId,
    timeRange,
    liquidityFilter,
    onNetworkIdChange: setSelectedNetworkId,
    onTimeRangeChange: setTimeRange,
    onLiquidityFilterChange: setLiquidityFilter,
  };

  return (
    <>
      <MarketFilterBarSmall {...filterBarProps} />
      <MarketTokenList
        networkId={selectedNetworkId}
        liquidityFilter={liquidityFilter}
      />
    </>
  );
}
