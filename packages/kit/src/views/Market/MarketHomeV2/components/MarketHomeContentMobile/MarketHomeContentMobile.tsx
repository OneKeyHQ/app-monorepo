import { MarketFilterBarSmall } from '../MarketFilterBarSmall';
import { MarketTokenList } from '../MarketTokenList';

import type { ILiquidityFilter } from '../../types';
import type { ITimeRangeSelectorValue } from '../TimeRangeSelector';

interface IMarketHomeContentMobileProps {
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

export function MarketHomeContentMobile({
  filterBarProps,
  selectedNetworkId,
  liquidityFilter,
}: IMarketHomeContentMobileProps) {
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
