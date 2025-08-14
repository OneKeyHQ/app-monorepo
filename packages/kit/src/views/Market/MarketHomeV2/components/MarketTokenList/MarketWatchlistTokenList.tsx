import type { ReactNode } from 'react';
import { useMemo } from 'react';

import { useMarketWatchListV2Atom } from '@onekeyhq/kit/src/states/jotai/contexts/marketV2';
import type { IMarketWatchListItemV2 } from '@onekeyhq/shared/types/market';

import { useMarketWatchlistTokenList } from './hooks/useMarketWatchlistTokenList';
import { type IMarketToken } from './MarketTokenData';
import { MarketTokenListBase } from './MarketTokenListBase';

type IMarketWatchlistTokenListProps = {
  networkId?: string;
  onItemPress?: (item: IMarketToken) => void;
  watchlist?: IMarketWatchListItemV2[];
  toolbar?: ReactNode;
};

function MarketWatchlistTokenList({
  networkId = 'sol--101',
  onItemPress,
  watchlist: externalWatchlist,
  toolbar,
}: IMarketWatchlistTokenListProps) {
  // Get watchlist from atom if not provided externally
  const [watchlistState] = useMarketWatchListV2Atom();
  const internalWatchlist = useMemo(
    () => watchlistState.data || [],
    [watchlistState.data],
  );

  // Use external watchlist if provided, otherwise use internal
  const watchlist = externalWatchlist || internalWatchlist;

  const watchlistResult = useMarketWatchlistTokenList({
    watchlist,
    pageSize: 999,
  });

  return (
    <MarketTokenListBase
      networkId={networkId}
      onItemPress={onItemPress}
      toolbar={toolbar}
      result={watchlistResult}
      isWatchlistMode
    />
  );
}

export { MarketWatchlistTokenList };
