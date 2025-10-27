import type { ReactNode } from 'react';
import { useEffect, useMemo } from 'react';

import {
  useMarketWatchListV2Atom,
  useWatchListV2Actions,
} from '@onekeyhq/kit/src/states/jotai/contexts/marketV2';
import { useMarketBasicConfig } from '@onekeyhq/kit/src/views/Market/hooks';
import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
import type { IMarketWatchListItemV2 } from '@onekeyhq/shared/types/market';

import { MarketRecommendList } from '../MarketRecommendList';

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
  const { recommendedTokens } = useMarketBasicConfig();

  const actions = useWatchListV2Actions();

  useEffect(() => {
    const fn = async () => {
      await actions.current.refreshWatchListV2();
    };
    appEventBus.on(EAppEventBusNames.RefreshMarketWatchList, fn);
    return () => {
      appEventBus.off(EAppEventBusNames.RefreshMarketWatchList, fn);
    };
  }, [actions]);

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

  // console.log('MarketWatchlistTokenList___watchlistResult', {
  //   watchlist,
  //   watchlistResult,
  // });

  // Show recommend list when watchlist is empty
  if (watchlist.length === 0) {
    return <MarketRecommendList recommendedTokens={recommendedTokens} />;
  }

  return (
    <MarketTokenListBase
      onItemPress={onItemPress}
      toolbar={toolbar}
      result={watchlistResult}
      isWatchlistMode
    />
  );
}

export { MarketWatchlistTokenList };
