import type { ReactNode } from 'react';

import { useMarketTokenList } from './hooks/useMarketTokenList';
import { type IMarketToken } from './MarketTokenData';
import { MarketTokenListBase } from './MarketTokenListBase';

import type { IMarketTokenListLiveOverride } from './MarketTokenListBase';

type IMarketNormalTokenListProps = {
  networkId?: string;
  selectedCategory?: string;
  timeRange?: string;
  sortBy?: string;
  sortType?: 'asc' | 'desc';
  onItemPress?: (item: IMarketToken) => void;
  toolbar?: ReactNode;
  tabIntegrated?: boolean;
  tabName?: string;
  listContainerProps?: {
    paddingBottom: number;
  };
  hiddenDesktopColumns?: readonly string[];
  liveTokenOverride?: IMarketTokenListLiveOverride;
  pollingInterval?: number;
  rowBg?: string;
};

function MarketNormalTokenList({
  networkId = 'sol--101',
  selectedCategory,
  timeRange,
  sortBy: initialSortBy,
  sortType: initialSortType,
  onItemPress,
  toolbar,
  tabIntegrated,
  tabName,
  listContainerProps,
  hiddenDesktopColumns,
  liveTokenOverride,
  pollingInterval,
  rowBg,
}: IMarketNormalTokenListProps) {
  const normalResult = useMarketTokenList({
    networkId,
    initialSortBy,
    initialSortType,
    pageSize: 20,
    type: selectedCategory,
    timeRange,
    pollingInterval,
  });

  return (
    <MarketTokenListBase
      networkId={networkId}
      onItemPress={onItemPress}
      toolbar={toolbar}
      result={normalResult}
      isWatchlistMode={false}
      showEndReachedIndicator
      tabIntegrated={tabIntegrated}
      tabName={tabName}
      listContainerProps={listContainerProps}
      showStockSubtitle={false}
      hiddenDesktopColumns={hiddenDesktopColumns}
      liveTokenOverride={liveTokenOverride}
      rowBg={rowBg}
    />
  );
}

export { MarketNormalTokenList };
