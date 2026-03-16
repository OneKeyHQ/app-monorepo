import type { ReactNode } from 'react';

import { useMarketTokenList } from './hooks/useMarketTokenList';
import { type IMarketToken } from './MarketTokenData';
import { MarketTokenListBase } from './MarketTokenListBase';

type IMarketNormalTokenListProps = {
  networkId?: string;
  sortBy?: string;
  sortType?: 'asc' | 'desc';
  onItemPress?: (item: IMarketToken) => void;
  toolbar?: ReactNode;
  tabIntegrated?: boolean;
  tabName?: string;
  listContainerProps?: {
    paddingBottom: number;
  };
};

function MarketNormalTokenList({
  networkId = 'sol--101',
  sortBy: initialSortBy,
  sortType: initialSortType,
  onItemPress,
  toolbar,
  tabIntegrated,
  tabName,
  listContainerProps,
}: IMarketNormalTokenListProps) {
  const normalResult = useMarketTokenList({
    networkId,
    initialSortBy,
    initialSortType,
    pageSize: 20,
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
    />
  );
}

export { MarketNormalTokenList };
