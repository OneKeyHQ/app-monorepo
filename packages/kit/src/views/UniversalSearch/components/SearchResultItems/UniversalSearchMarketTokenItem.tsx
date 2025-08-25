import { useCallback } from 'react';

import { XStack, rootNavigationRef } from '@onekeyhq/components';
import { ListItem } from '@onekeyhq/kit/src/components/ListItem';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { useMarketV2Enabled } from '@onekeyhq/kit/src/hooks/useMarketV2Enabled';
import { useMarketWatchListAtom } from '@onekeyhq/kit/src/states/jotai/contexts/market/atoms';
import { useUniversalSearchActions } from '@onekeyhq/kit/src/states/jotai/contexts/universalSearch';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import { EWatchlistFrom } from '@onekeyhq/shared/src/logger/scopes/market/scenes/token';
import {
  ERootRoutes,
  ETabMarketRoutes,
  ETabRoutes,
} from '@onekeyhq/shared/src/routes';
import { EUniversalSearchPages } from '@onekeyhq/shared/src/routes/universalSearch';
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
  const appNavigation = useAppNavigation();
  // Ensure market watch list atom is initialized
  const [{ isMounted }] = useMarketWatchListAtom();
  const universalSearchActions = useUniversalSearchActions();
  const { image, coingeckoId, price, symbol, name, lastUpdated } = item.payload;

  const enableMarketV2 = useMarketV2Enabled();

  const handlePress = useCallback(() => {
    if (!enableMarketV2) {
      rootNavigationRef.current?.goBack();
    }
    setTimeout(async () => {
      if (enableMarketV2) {
        appNavigation.push(EUniversalSearchPages.MarketDetail, {
          token: coingeckoId,
        });
      } else {
        rootNavigationRef.current?.navigate(ERootRoutes.Main, {
          screen: ETabRoutes.Market,
          params: {
            screen: ETabMarketRoutes.MarketDetail,
            params: {
              token: coingeckoId,
            },
          },
        });
      }
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
    appNavigation,
    coingeckoId,
    item.type,
    searchStatus,
    symbol,
    universalSearchActions,
    enableMarketV2,
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
        {enableMarketV2 ? null : (
          <MarketStar
            coingeckoId={coingeckoId}
            ml="$3"
            from={EWatchlistFrom.search}
          />
        )}
      </XStack>
    </ListItem>
  );
}
