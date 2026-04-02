import { useCallback } from 'react';

import { XStack } from '@onekeyhq/components';
import { Currency } from '@onekeyhq/kit/src/components/Currency';
import { ListItem } from '@onekeyhq/kit/src/components/ListItem';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { useMarketWatchListAtom } from '@onekeyhq/kit/src/states/jotai/contexts/market/atoms';
import { useUniversalSearchActions } from '@onekeyhq/kit/src/states/jotai/contexts/universalSearch';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import { EUniversalSearchPages } from '@onekeyhq/shared/src/routes/universalSearch';
import { formatTokenSymbolForDisplay } from '@onekeyhq/shared/src/utils/tokenUtils';
import type { IUniversalSearchMarketToken } from '@onekeyhq/shared/types/search';
import { ESearchStatus } from '@onekeyhq/shared/types/search';

import { MarketTokenIcon } from '../../../Market/components/MarketTokenIcon';

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
  const { image, coingeckoId, price, symbol, name } = item.payload;

  const handlePress = useCallback(() => {
    setTimeout(async () => {
      appNavigation.push(EUniversalSearchPages.MarketDetail, {
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
    appNavigation,
    coingeckoId,
    item.type,
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
      title={formatTokenSymbolForDisplay(symbol)}
      subtitle={name}
      subtitleProps={{
        numberOfLines: 1,
      }}
    >
      <XStack>
        <Currency size="$bodyLgMedium">{String(price)}</Currency>
      </XStack>
    </ListItem>
  );
}
