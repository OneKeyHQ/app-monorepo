import { MarketFilterBar } from '../MarketFilterBar';
import { MarketTokenList } from '../MarketTokenList';

import type { ILiquidityFilter } from '../../types';
import type { ITimeRangeSelectorValue } from '../TimeRangeSelector';

interface IMarketHomeContentProps {
  filterBarProps: {
    selectedNetworkId: string;
    timeRange: ITimeRangeSelectorValue;
    liquidityFilter: ILiquidityFilter;
    onNetworkIdChange: (networkId: string) => void;
    onTimeRangeChange: (timeRange: ITimeRangeSelectorValue) => void;
    onLiquidityFilterChange: (filter: ILiquidityFilter) => void;
  };
  selectedNetworkId: string;
  liquidityFilter: ILiquidityFilter;
}

export function MarketHomeContent({
  filterBarProps,
  selectedNetworkId,
  liquidityFilter,
}: IMarketHomeContentProps) {
  return (
    <>
      <MarketFilterBar {...filterBarProps} />
      <MarketTokenList
        networkId={selectedNetworkId}
        liquidityFilter={liquidityFilter}
      />
    </>
  );
}
