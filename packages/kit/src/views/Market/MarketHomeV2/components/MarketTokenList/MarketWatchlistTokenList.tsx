import type { ReactNode } from 'react';
import { useMemo } from 'react';

import {
  useMarketWatchListV2Atom,
  useSelectedNetworkIdAtom,
} from '@onekeyhq/kit/src/states/jotai/contexts/marketV2';
import type { IMarketWatchListItemV2 } from '@onekeyhq/shared/types/market';

import {
  MarketRecommendList,
  mockRecommendedTokens,
} from '../MarketRecommendList';

import { useMarketWatchlistTokenList } from './hooks/useMarketWatchlistTokenList';
import { type IMarketToken } from './MarketTokenData';
import { MarketTokenListBase } from './MarketTokenListBase';

type IMarketWatchlistTokenListProps = {
  onItemPress?: (item: IMarketToken) => void;
  watchlist?: IMarketWatchListItemV2[];
  toolbar?: ReactNode;
};

function MarketWatchlistTokenList({
  onItemPress,
  watchlist: externalWatchlist,
  toolbar,
}: IMarketWatchlistTokenListProps) {
  // Get watchlist from atom if not provided externally
  const [watchlistState] = useMarketWatchListV2Atom();
  const [selectedNetworkId] = useSelectedNetworkIdAtom();
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

  // Show recommend list when watchlist is empty
  if (watchlist.length === 0) {
    return (
      <MarketRecommendList
        recommendedTokens={mockRecommendedTokens}
        networkId={selectedNetworkId}
      />
    );
  }

  return (
    <MarketTokenListBase
      key={JSON.stringify(watchlist)}
      onItemPress={onItemPress}
      toolbar={toolbar}
      result={watchlistResult}
      isWatchlistMode
    />
  );
}

export { MarketWatchlistTokenList };
