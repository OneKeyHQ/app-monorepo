import { memo, useCallback, useEffect, useMemo, useRef } from 'react';

import { useIntl } from 'react-intl';

import {
  SizableText,
  Stack,
  Tabs,
  Toast,
  useScrollContentTabBarOffset,
} from '@onekeyhq/components';
import { Portal } from '@onekeyhq/components/src/hocs';
import type { IPortalManager } from '@onekeyhq/components/src/hocs/Portal';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import {
  useMarketWatchListV2Atom,
  useWatchListV2Actions,
} from '@onekeyhq/kit/src/states/jotai/contexts/marketV2';
import { useMarketBasicConfig } from '@onekeyhq/kit/src/views/Market/hooks';
import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import type { IMarketWatchListItemV2 } from '@onekeyhq/shared/types/market';

import { usePerpsNavigation } from '../../../hooks/usePerpsNavigation';
import { MarketRecommendList } from '../MarketRecommendList';

import { InlineActionBar } from './components/InlineActionBar';
import { TokenListItem } from './components/TokenListItem';
import { TokenListSkeleton } from './components/TokenListSkeleton';
import { useMarketWatchlistTokenList } from './hooks/useMarketWatchlistTokenList';
import { useToDetailPage } from './hooks/useToMarketDetailPage';

import type { IMarketToken } from './MarketTokenData';
import type { FlatListProps } from 'react-native';

interface IMobileMarketWatchlistFlatListProps {
  listContainerProps: {
    paddingBottom: number;
  };
}

const EMPTY_DATA: IMarketToken[] = [];

function MobileMarketWatchlistFlatListImpl({
  listContainerProps,
}: IMobileMarketWatchlistFlatListProps) {
  const intl = useIntl();
  const toMarketDetailPage = useToDetailPage();
  const { navigateToPerps } = usePerpsNavigation();

  // Watchlist data
  const [watchlistState] = useMarketWatchListV2Atom();
  const { recommendedTokens } = useMarketBasicConfig();
  const actions = useWatchListV2Actions();

  useEffect(() => {
    const fn = async () => {
      await actions.current.refreshWatchListV2();
    };
    appEventBus.on(EAppEventBusNames.RefreshMarketWatchList, fn);
    appEventBus.on(EAppEventBusNames.MarketWatchListV2Changed, fn);
    return () => {
      appEventBus.off(EAppEventBusNames.RefreshMarketWatchList, fn);
      appEventBus.off(EAppEventBusNames.MarketWatchListV2Changed, fn);
    };
  }, [actions]);

  useEffect(() => {
    void backgroundApiProxy.serviceMarketV2.reconcilePerpsFavorites();
  }, []);

  const watchlist = useMemo(
    () => watchlistState.data || [],
    [watchlistState.data],
  );

  const watchlistResult = useMarketWatchlistTokenList({
    watchlist,
    pageSize: 999,
  });

  const portalRef = useRef<IPortalManager | null>(null);

  const tokenToWatchListItem = useCallback(
    (token: IMarketToken): IMarketWatchListItemV2 => ({
      chainId: token.networkId,
      contractAddress: token.address,
      sortIndex: token.sortIndex,
      isNative: token.isNative,
      perpsCoin: token.perpsCoin,
    }),
    [],
  );

  const handleShowContextMenu = useCallback(
    (item: IMarketToken, index: number) => {
      if (portalRef.current) {
        portalRef.current.destroy();
        portalRef.current = null;
      }

      portalRef.current = Portal.Render(
        Portal.Constant.FULL_WINDOW_OVERLAY_PORTAL,
        <InlineActionBar
          isFirstItem={index === 0}
          onMoveToTop={async () => {
            portalRef.current?.destroy();
            portalRef.current = null;
            try {
              await actions.current.moveToTopV2(tokenToWatchListItem(item));
              Toast.success({
                title: intl.formatMessage({
                  id: ETranslations.market_move_to_top,
                }),
              });
            } catch {
              // error handled internally
            }
          }}
          onToggleWatchlist={async () => {
            portalRef.current?.destroy();
            portalRef.current = null;
            try {
              if (item.perpsCoin) {
                await actions.current.removePerpsFromWatchListV2(
                  item.perpsCoin,
                );
              } else {
                await actions.current.removeFromWatchListV2(
                  item.networkId,
                  item.address,
                );
              }
              Toast.success({
                title: intl.formatMessage({
                  id: ETranslations.market_remove_from_watchlist,
                }),
              });
            } catch {
              // error handled internally
            }
          }}
          onDismiss={() => {
            portalRef.current?.destroy();
            portalRef.current = null;
          }}
        />,
      );
    },
    [actions, intl, tokenToWatchListItem],
  );

  useEffect(
    () => () => {
      if (portalRef.current) {
        portalRef.current.destroy();
        portalRef.current = null;
      }
    },
    [],
  );

  const renderItem: FlatListProps<IMarketToken>['renderItem'] = useCallback(
    ({ item, index }: { item: IMarketToken; index: number }) => (
      <TokenListItem
        item={item}
        onPress={() => {
          if (item.perpsCoin) {
            navigateToPerps(item.perpsCoin);
            return;
          }
          void toMarketDetailPage({
            symbol: item.symbol,
            tokenAddress: item.address,
            networkId: item.networkId,
            isNative: item.isNative,
          });
        }}
        onLongPress={() => handleShowContextMenu(item, index)}
      />
    ),
    [toMarketDetailPage, navigateToPerps, handleShowContextMenu],
  );

  const keyExtractor = useCallback((item: IMarketToken) => item.id, []);

  const getItemLayout = useCallback(
    (_: ArrayLike<IMarketToken> | null | undefined, index: number) => ({
      length: 73,
      offset: 73 * index,
      index,
    }),
    [],
  );

  const { data, isLoading } = watchlistResult;
  const showSkeleton = Boolean(isLoading) && data.length === 0;

  const ListEmptyComponent = useMemo(() => {
    if (showSkeleton) {
      return <TokenListSkeleton count={10} />;
    }
    return (
      <Stack flex={1} alignItems="center" justifyContent="center" p="$8">
        <SizableText size="$bodyLg" color="$textSubdued">
          {intl.formatMessage({ id: ETranslations.global_no_data })}
        </SizableText>
      </Stack>
    );
  }, [showSkeleton, intl]);

  const tabBarHeight = useScrollContentTabBarOffset();

  // Wait for data to be loaded
  if (!watchlistState.isMounted) {
    return <Tabs.ScrollView />;
  }

  // Show recommend list when watchlist is empty
  if (watchlist.length === 0) {
    return (
      <Tabs.ScrollView>
        <MarketRecommendList recommendedTokens={recommendedTokens} />
      </Tabs.ScrollView>
    );
  }

  return (
    <Tabs.FlatList<IMarketToken>
      showsVerticalScrollIndicator={false}
      data={showSkeleton ? EMPTY_DATA : data}
      renderItem={renderItem}
      keyExtractor={keyExtractor}
      getItemLayout={getItemLayout}
      initialNumToRender={15}
      maxToRenderPerBatch={20}
      windowSize={platformEnv.isNativeAndroid ? 7 : 3}
      removeClippedSubviews={platformEnv.isNativeIOS}
      ListEmptyComponent={ListEmptyComponent}
      contentContainerStyle={{
        paddingTop: 8 + (platformEnv.isNative ? 200 : 0),
        paddingBottom: platformEnv.isNativeAndroid
          ? listContainerProps.paddingBottom
          : tabBarHeight,
      }}
    />
  );
}

export const MobileMarketWatchlistFlatList = memo(
  MobileMarketWatchlistFlatListImpl,
);
