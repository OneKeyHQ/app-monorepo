import { memo, useCallback, useEffect, useMemo, useRef } from 'react';

import { useIntl } from 'react-intl';

import {
  SizableText,
  Stack,
  Toast,
  useScrollContentTabBarOffset,
} from '@onekeyhq/components';
import type { IPortalManager } from '@onekeyhq/components/src/hocs/Portal';
import { mountImperativeOverlay } from '@onekeyhq/components/src/shared/imperativeOverlayMount';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { AppPagerContent } from '@onekeyhq/kit/src/components/AppPager/AppPagerContent';
import {
  useMarketWatchListV2Atom,
  useWatchListV2Actions,
} from '@onekeyhq/kit/src/states/jotai/contexts/marketV2';
import { useMarketBasicConfig } from '@onekeyhq/kit/src/views/Market/hooks';
import { prewarmMarketTokenImages } from '@onekeyhq/kit/src/views/Market/MarketDetailV2/utils/marketDetailImagePreload';
import { preloadMarketDetailV2Page } from '@onekeyhq/kit/src/views/Market/MarketDetailV2/utils/marketDetailPagePreload';
import { resolveMarketStockId } from '@onekeyhq/kit/src/views/Market/MarketDetailV2/utils/resolveIsStockToken';
import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { EEnterWay } from '@onekeyhq/shared/src/logger/scopes/dex';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import type { IMarketWatchListItemV2 } from '@onekeyhq/shared/types/market';

import { usePerpsNavigation } from '../../../hooks/usePerpsNavigation';
import { getMarketEmptyWatchlistContainerProps } from '../../layouts/mobileLayoutUtils';
import { buildTokenMarketRow } from '../MarketNativeList/marketNativeListRows';
import { WebMarketCompactList } from '../MarketNativeList/WebMarketCompactList';
import { MarketRecommendList } from '../MarketRecommendList';

import { InlineActionBar } from './components/InlineActionBar';
import { TokenListSkeleton } from './components/TokenListSkeleton';
import { useMarketWatchlistTokenList } from './hooks/useMarketWatchlistTokenList';
import { useToDetailPage } from './hooks/useToMarketDetailPage';
import { useWatchlistFilteredGroups } from './hooks/useWatchlistFilteredGroups';
import { DEFAULT_WATCHLIST_FILTER } from './MarketWatchlistCategorySelector';

import type { IMarketToken } from './MarketTokenData';
import type { IWatchlistFilterType } from './MarketWatchlistCategorySelector';
import type { IMarketNativeListPresentation } from '../MarketNativeList/marketNativeListRows';

interface IMobileMarketWatchlistFlatListProps {
  selectedFilter?: IWatchlistFilterType;
  shouldSuppressItemPress?: () => boolean;
}

const EMPTY_DATA: IMarketToken[] = [];

function MobileMarketWatchlistFlatListImpl({
  selectedFilter = DEFAULT_WATCHLIST_FILTER,
  shouldSuppressItemPress,
}: IMobileMarketWatchlistFlatListProps) {
  const intl = useIntl();
  const toMarketDetailPage = useToDetailPage({ from: EEnterWay.MarketList });
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

  const filteredGroups = useWatchlistFilteredGroups(watchlistResult.data);

  const filteredData = filteredGroups[selectedFilter];

  const portalRef = useRef<IPortalManager | null>(null);
  const tokenToWatchListItem = useCallback(
    (token: IMarketToken): IMarketWatchListItemV2 => ({
      chainId: token.networkId,
      contractAddress: token.address,
      sortIndex: token.sortIndex,
      isNative: token.isNative,
      perpsCoin: token.perpsCoin,
      assetId: token.assetId,
      stockId: token.stockId,
    }),
    [],
  );

  const dismissInlineActionBar = useCallback(() => {
    if (portalRef.current) {
      portalRef.current.destroy();
      portalRef.current = null;
    }
  }, []);

  const handleShowContextMenu = useCallback(
    (
      item: IMarketToken,
      index: number,
      anchor?: {
        x: number;
        y: number;
      },
    ) => {
      dismissInlineActionBar();

      portalRef.current = mountImperativeOverlay({
        target: 'global',
        node: (
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
                    { assetId: item.assetId, stockId: item.stockId },
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
            anchor={anchor}
          />
        ),
      });
    },
    [actions, dismissInlineActionBar, intl, tokenToWatchListItem],
  );

  useEffect(() => dismissInlineActionBar, [dismissInlineActionBar]);

  const { data, isLoading } = watchlistResult;
  const showSkeleton = Boolean(isLoading) && data.length === 0;

  const ListEmptyComponent = useMemo(() => {
    if (showSkeleton) {
      return <TokenListSkeleton count={10} />;
    }
    return (
      <Stack alignItems="center" justifyContent="center" p="$8" mt="$10">
        <SizableText size="$bodyLg" color="$textSubdued">
          {intl.formatMessage({ id: ETranslations.global_no_data })}
        </SizableText>
      </Stack>
    );
  }, [showSkeleton, intl]);

  const tabBarHeight = useScrollContentTabBarOffset();
  const buildWebRow = useCallback(
    ({
      item,
      presentation,
    }: {
      item: IMarketToken;
      presentation: IMarketNativeListPresentation;
    }) => buildTokenMarketRow({ item, presentation, watchlist: true }),
    [],
  );
  const handleWebPressIn = useCallback((item: IMarketToken) => {
    const token = item;
    void preloadMarketDetailV2Page({
      includeBodyModules: true,
      includeHeavyModules: true,
      isStockRoute: Boolean(resolveMarketStockId(token)),
      layout: 'mobile',
    });
    prewarmMarketTokenImages(token);
  }, []);
  const handleWebPress = useCallback(
    (item: IMarketToken) => {
      if (shouldSuppressItemPress?.()) return;
      if (item.perpsCoin) {
        navigateToPerps(item.perpsCoin);
        return;
      }
      void toMarketDetailPage({
        ...item,
        symbol: item.symbol,
        tokenAddress: item.address,
        networkId: item.networkId,
        isNative: item.isNative,
      });
    },
    [navigateToPerps, shouldSuppressItemPress, toMarketDetailPage],
  );

  const Content = AppPagerContent;

  // Wait for data to be loaded
  if (!watchlistState.isMounted) {
    return <Content />;
  }

  if (!showSkeleton && (watchlist.length === 0 || data.length === 0)) {
    return (
      <Content>
        <Stack
          justifyContent="center"
          {...getMarketEmptyWatchlistContainerProps({
            isNativeAndroid: false,
            isWeb: Boolean(platformEnv.isWeb),
          })}
          alignItems="center"
        >
          <MarketRecommendList
            maxSize={8}
            recommendedTokens={recommendedTokens}
          />
        </Stack>
      </Content>
    );
  }

  return (
    <WebMarketCompactList<IMarketToken>
      data={showSkeleton ? EMPTY_DATA : filteredData}
      buildRow={buildWebRow}
      onPress={handleWebPress}
      onPressIn={handleWebPressIn}
      onLongPress={handleShowContextMenu}
      onScrollBegin={dismissInlineActionBar}
      empty={ListEmptyComponent}
      contentPaddingBottom={tabBarHeight}
    />
  );
}

export const MobileMarketWatchlistFlatList = memo(
  MobileMarketWatchlistFlatListImpl,
);
