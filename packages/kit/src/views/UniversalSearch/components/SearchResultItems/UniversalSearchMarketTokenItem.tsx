import { useCallback, useEffect } from 'react';

import { XStack } from '@onekeyhq/components';
import { ListItem } from '@onekeyhq/kit/src/components/ListItem';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { useMarketWatchListAtom } from '@onekeyhq/kit/src/states/jotai/contexts/market/atoms';
import { useUniversalSearchActions } from '@onekeyhq/kit/src/states/jotai/contexts/universalSearch';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import { EWatchlistFrom } from '@onekeyhq/shared/src/logger/scopes/market/scenes/token';
import { ETabMarketRoutes, ETabRoutes } from '@onekeyhq/shared/src/routes';
import type { IUniversalSearchMarketToken } from '@onekeyhq/shared/types/search';
import { ESearchStatus } from '@onekeyhq/shared/types/search';

import { MarketStar } from '../../../Market/components/MarketStar';
import { MarketTokenIcon } from '../../../Market/components/MarketTokenIcon';
import { MarketTokenPrice } from '../../../Market/components/MarketTokenPrice';

interface IUniversalSearchMarketTokenItemProps {
  item: IUniversalSearchMarketToken;
  searchStatus: ESearchStatus;
}

export function UniversalSearchMarketTokenItem({
  item,
  searchStatus,
}: IUniversalSearchMarketTokenItemProps) {
  const navigation = useAppNavigation();
  // Ensure market watch list atom is initialized
  const [{ isMounted }] = useMarketWatchListAtom();
  const universalSearchActions = useUniversalSearchActions();
  const { image, coingeckoId, price, symbol, name, lastUpdated } = item.payload;

  const handlePress = useCallback(() => {
    navigation.pop();
    setTimeout(async () => {
      navigation.switchTab(ETabRoutes.Market);
      navigation.push(ETabMarketRoutes.MarketDetail, {
        token: coingeckoId,
      });
      defaultLogger.market.token.searchToken({
        tokenSymbol: coingeckoId,
        from:
          searchStatus === ESearchStatus.init ? 'trendingList' : 'searchList',
      });
      
      // Only add to recent search list when not in trending section
      if (searchStatus !== ESearchStatus.init) {
        setTimeout(() => {
          universalSearchActions.current.addIntoRecentSearchList({
            id: coingeckoId,
            text: symbol,
            type: item.type,
            timestamp: Date.now(),
          });
        }, 10);
      }
    }, 80);
  }, [
    coingeckoId,
    item.type,
    navigation,
    searchStatus,
    symbol,
    universalSearchActions,
  ]);

  if (!isMounted) {
    return null;
  }

  return (
    <ListItem
      jc="space-between"
      onPress={handlePress}
      renderAvatar={<MarketTokenIcon uri={image} size="lg" />}
      title={symbol.toUpperCase()}
      subtitle={name}
      subtitleProps={{
        numberOfLines: 1,
      }}
    >
      <XStack>
        <MarketTokenPrice
          price={String(price)}
          size="$bodyLgMedium"
          lastUpdated={lastUpdated}
          tokenName={name}
          tokenSymbol={symbol}
        />
        <MarketStar
          coingeckoId={coingeckoId}
          ml="$3"
          from={EWatchlistFrom.search}
        />
      </XStack>
    </ListItem>
  );
}
