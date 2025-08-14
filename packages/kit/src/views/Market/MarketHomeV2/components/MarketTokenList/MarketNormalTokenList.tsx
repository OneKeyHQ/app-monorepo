import type { ReactNode } from 'react';

import { useMarketTokenList } from './hooks/useMarketTokenList';
import { type IMarketToken } from './MarketTokenData';
import { MarketTokenListBase } from './MarketTokenListBase';

type IMarketNormalTokenListProps = {
  networkId?: string;
  sortBy?: string;
  sortType?: 'asc' | 'desc';
  onItemPress?: (item: IMarketToken) => void;
  pageSize?: number;
  toolbar?: ReactNode;
};

function MarketNormalTokenList({
  networkId = 'sol--101',
  sortBy: initialSortBy,
  sortType: initialSortType,
  onItemPress,
  pageSize = 20,
  toolbar,
}: IMarketNormalTokenListProps) {
  const normalResult = useMarketTokenList({
    networkId,
    initialSortBy,
    initialSortType,
    pageSize,
  });

  return (
    <MarketTokenListBase
      networkId={networkId}
      onItemPress={onItemPress}
      pageSize={pageSize}
      toolbar={toolbar}
      result={normalResult}
      isWatchlistMode={false}
    />
  );
}

export { MarketNormalTokenList };
