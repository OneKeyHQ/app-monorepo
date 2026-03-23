import { memo, useCallback, useEffect, useMemo, useRef } from 'react';

import { useIntl } from 'react-intl';
import {
  Dimensions,
  type FlatListProps,
  type GestureResponderEvent,
} from 'react-native';

import {
  Haptics,
  ImpactFeedbackStyle,
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
import { useWatchlistFilteredGroups } from './hooks/useWatchlistFilteredGroups';

import type { IMarketToken } from './MarketTokenData';
import type { IWatchlistFilterType } from './MarketWatchlistCategorySelector';

interface IMobileMarketWatchlistFlatListProps {
  selectedFilter?: IWatchlistFilterType;
  listContainerProps: {
    paddingBottom: number;
  };
}

const EMPTY_DATA: IMarketToken[] = [];
const FIRST_LEVEL_LONG_PRESS_DELAY_MS = 800;
const CANCEL_MENU_MOVE_THRESHOLD_PX = 10;
const PRESS_STATIONARY_THRESHOLD_PX = 3;
const ROW_HEIGHT_FALLBACK_PX = 60;
const SECOND_LEVEL_MENU_ANCHOR_X_RATIO = 0.48;
const SECOND_LEVEL_MENU_ANCHOR_Y_OFFSET = 4;

function MobileMarketWatchlistFlatListImpl({
  selectedFilter = 'all',
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

  const filteredGroups = useWatchlistFilteredGroups(watchlistResult.data);

  const filteredData = filteredGroups[selectedFilter];
  const rowHeightsRef = useRef<Record<string, number>>({});

  const portalRef = useRef<IPortalManager | null>(null);
  const gestureRef = useRef<{
    activeItemId: string;
    pressX: number;
    pressY: number;
    lastPageX: number;
    lastPageY: number;
    rowTop: number;
    rowBottom: number;
    hasMoved: boolean;
    menuTimer: ReturnType<typeof setTimeout> | null;
    consumeNextPress: boolean;
  }>({
    activeItemId: '',
    pressX: 0,
    pressY: 0,
    lastPageX: 0,
    lastPageY: 0,
    rowTop: 0,
    rowBottom: 0,
    hasMoved: false,
    menuTimer: null,
    consumeNextPress: false,
  });

  const getStableItemKey = useCallback(
    (item: IMarketToken) =>
      item.perpsCoin
        ? `perps:${item.perpsCoin}`
        : `${item.networkId}:${(item.address || '').toLowerCase()}:${item.isNative ? 1 : 0}`,
    [],
  );

  const clearMenuTimer = useCallback(() => {
    if (gestureRef.current.menuTimer) {
      clearTimeout(gestureRef.current.menuTimer);
      gestureRef.current.menuTimer = null;
    }
  }, []);

  const resetGestureSession = useCallback(() => {
    gestureRef.current.activeItemId = '';
    gestureRef.current.hasMoved = false;
    gestureRef.current.rowTop = 0;
    gestureRef.current.rowBottom = 0;
    gestureRef.current.lastPageX = 0;
    gestureRef.current.lastPageY = 0;
  }, []);

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
          anchor={anchor}
        />,
      );
    },
    [actions, dismissInlineActionBar, intl, tokenToWatchListItem],
  );

  useEffect(
    () => () => {
      clearMenuTimer();
      resetGestureSession();
      if (portalRef.current) {
        portalRef.current.destroy();
        portalRef.current = null;
      }
    },
    [clearMenuTimer, resetGestureSession],
  );

  const renderItem: FlatListProps<IMarketToken>['renderItem'] = useCallback(
    ({ item, index }: { item: IMarketToken; index: number }) => {
      const itemKey = getStableItemKey(item);
      return (
        <TokenListItem
          item={item}
          onPress={() => {
            if (gestureRef.current.consumeNextPress) {
              gestureRef.current.consumeNextPress = false;
              return;
            }
            clearMenuTimer();
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
          onPressIn={(event: GestureResponderEvent) => {
            clearMenuTimer();
            const {
              pageX = 0,
              pageY = 0,
              locationY = ROW_HEIGHT_FALLBACK_PX / 2,
            } = event.nativeEvent;
            const current = gestureRef.current;
            const rowHeight =
              rowHeightsRef.current[itemKey] ?? ROW_HEIGHT_FALLBACK_PX;
            const rowTop = pageY - locationY;
            current.activeItemId = itemKey;
            current.pressX = pageX;
            current.pressY = pageY;
            current.lastPageX = pageX;
            current.lastPageY = pageY;
            current.rowTop = rowTop;
            current.rowBottom = rowTop + rowHeight;
            current.hasMoved = false;
            current.consumeNextPress = false;
            current.menuTimer = setTimeout(() => {
              const latest = gestureRef.current;
              if (latest.activeItemId !== itemKey || latest.hasMoved) {
                return;
              }
              const latestPageY = latest.lastPageY || pageY;
              const stillInsideRow =
                latestPageY >= latest.rowTop && latestPageY <= latest.rowBottom;
              if (!stillInsideRow) {
                return;
              }
              latest.consumeNextPress = true;
              clearMenuTimer();
              Haptics.impact(ImpactFeedbackStyle.Medium);
              const { width } = Dimensions.get('window');
              handleShowContextMenu(item, index, {
                x: width * SECOND_LEVEL_MENU_ANCHOR_X_RATIO,
                y: latestPageY - SECOND_LEVEL_MENU_ANCHOR_Y_OFFSET,
              });
              resetGestureSession();
            }, FIRST_LEVEL_LONG_PRESS_DELAY_MS);
          }}
          onTouchMove={(event: GestureResponderEvent) => {
            const current = gestureRef.current;
            if (current.activeItemId !== itemKey) {
              return;
            }
            const { pageX = 0, pageY = 0 } = event.nativeEvent;
            current.lastPageX = pageX;
            current.lastPageY = pageY;
            const deltaX = Math.abs(pageX - current.pressX);
            const deltaY = Math.abs(pageY - current.pressY);
            const movedDistance = Math.max(deltaX, deltaY);
            if (movedDistance > PRESS_STATIONARY_THRESHOLD_PX) {
              current.hasMoved = true;
            }
            if (movedDistance > CANCEL_MENU_MOVE_THRESHOLD_PX) {
              clearMenuTimer();
            }
          }}
          onLayout={(layoutEvent) => {
            rowHeightsRef.current[itemKey] =
              layoutEvent.nativeEvent.layout.height || ROW_HEIGHT_FALLBACK_PX;
          }}
          onPressOut={(event: GestureResponderEvent) => {
            const touchesLength = event.nativeEvent.touches?.length ?? 0;
            if (touchesLength > 0) {
              return;
            }
            clearMenuTimer();
            resetGestureSession();
          }}
          onTouchEnd={() => {
            clearMenuTimer();
            resetGestureSession();
          }}
        />
      );
    },
    [
      clearMenuTimer,
      getStableItemKey,
      handleShowContextMenu,
      navigateToPerps,
      resetGestureSession,
      toMarketDetailPage,
    ],
  );

  const keyExtractor = useCallback(
    (item: IMarketToken) => getStableItemKey(item),
    [getStableItemKey],
  );

  const { data, isLoading } = watchlistResult;
  const showSkeleton = Boolean(isLoading) && data.length === 0;

  const ListEmptyComponent = useMemo(() => {
    if (showSkeleton) {
      return <TokenListSkeleton count={10} />;
    }
    if (watchlist.length === 0) {
      return <MarketRecommendList recommendedTokens={recommendedTokens} />;
    }
    return (
      <Stack alignItems="center" justifyContent="center" p="$8" mt="$10">
        <SizableText size="$bodyLg" color="$textSubdued">
          {intl.formatMessage({ id: ETranslations.global_no_data })}
        </SizableText>
      </Stack>
    );
  }, [showSkeleton, intl, watchlist.length, recommendedTokens]);

  const tabBarHeight = useScrollContentTabBarOffset();
  const contentContainerStyle = useMemo(
    () => ({
      ...(platformEnv.isNative ? {} : { paddingTop: 8 }),
      paddingBottom: platformEnv.isNativeAndroid
        ? listContainerProps.paddingBottom
        : tabBarHeight,
    }),
    [listContainerProps.paddingBottom, tabBarHeight],
  );

  // Wait for data to be loaded
  if (!watchlistState.isMounted) {
    return <Tabs.ScrollView />;
  }

  return (
    <Tabs.FlatList<IMarketToken>
      showsVerticalScrollIndicator={false}
      data={showSkeleton ? EMPTY_DATA : filteredData}
      renderItem={renderItem}
      keyExtractor={keyExtractor}
      initialNumToRender={15}
      maxToRenderPerBatch={20}
      windowSize={platformEnv.isNativeAndroid ? 7 : 3}
      removeClippedSubviews={platformEnv.isNativeIOS}
      onScrollBeginDrag={dismissInlineActionBar}
      ListEmptyComponent={ListEmptyComponent}
      contentContainerStyle={contentContainerStyle}
    />
  );
}

export const MobileMarketWatchlistFlatList = memo(
  MobileMarketWatchlistFlatListImpl,
);
