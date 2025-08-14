import type { ReactNode } from 'react';

import type { IMarketWatchListItemV2 } from '@onekeyhq/shared/types/market';

import { useMarketWatchlistTokenList } from './hooks/useMarketWatchlistTokenList';
import { type IMarketToken } from './MarketTokenData';
import { MarketTokenListBase } from './MarketTokenListBase';

type IMarketWatchlistTokenListProps = {
  networkId?: string;
  onItemPress?: (item: IMarketToken) => void;
  pageSize?: number;
  watchlist?: IMarketWatchListItemV2[];
  toolbar?: ReactNode;
};

function MarketWatchlistTokenList({
  networkId = 'sol--101',
  onItemPress,
  pageSize = 20,
  watchlist = [],
  toolbar,
}: IMarketWatchlistTokenListProps) {
  const watchlistResult = useMarketWatchlistTokenList({
    watchlist,
    pageSize,
  });

  return (
    <MarketTokenListBase
      networkId={networkId}
      onItemPress={onItemPress}
      pageSize={pageSize}
      toolbar={toolbar}
      result={watchlistResult}
      isWatchlistMode
    />
  );
}

export { MarketWatchlistTokenList };
