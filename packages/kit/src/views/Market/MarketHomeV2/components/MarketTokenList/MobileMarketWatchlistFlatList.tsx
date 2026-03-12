import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { useIntl } from 'react-intl';
import { Dimensions, type GestureResponderEvent } from 'react-native';
import DraggableFlatList from 'react-native-draggable-flatlist';
import { globalRef } from 'react-native-draggable-flatlist/src/context/globalRef';

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
const FIRST_LEVEL_LONG_PRESS_DELAY_MS = 350;
const SECOND_LEVEL_MENU_DELAY_MS = 650;
const DRAG_MOVE_THRESHOLD_PX = 10;
const AUTOSCROLL_THRESHOLD_PX = 80;
const AUTOSCROLL_SPEED_PX = 180;

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
  const [previewDraggingItemId, setPreviewDraggingItemId] = useState<
    string | null
  >(null);

  const portalRef = useRef<IPortalManager | null>(null);
  const gestureRef = useRef<{
    activeItemId: string;
    pressX: number;
    pressY: number;
    firstLevelTriggered: boolean;
    movedBeyondThreshold: boolean;
    dragTimer: ReturnType<typeof setTimeout> | null;
    menuTimer: ReturnType<typeof setTimeout> | null;
    menuObserveTimer: ReturnType<typeof setInterval> | null;
    consumeNextPress: boolean;
  }>({
    activeItemId: '',
    pressX: 0,
    pressY: 0,
    firstLevelTriggered: false,
    movedBeyondThreshold: false,
    dragTimer: null,
    menuTimer: null,
    menuObserveTimer: null,
    consumeNextPress: false,
  });

  const clearDragTimer = useCallback(() => {
    if (gestureRef.current.dragTimer) {
      clearTimeout(gestureRef.current.dragTimer);
      gestureRef.current.dragTimer = null;
    }
  }, []);

  const clearMenuTimer = useCallback(() => {
    if (gestureRef.current.menuTimer) {
      clearTimeout(gestureRef.current.menuTimer);
      gestureRef.current.menuTimer = null;
    }
    if (gestureRef.current.menuObserveTimer) {
      clearInterval(gestureRef.current.menuObserveTimer);
      gestureRef.current.menuObserveTimer = null;
    }
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
      clearDragTimer();
      clearMenuTimer();
      if (portalRef.current) {
        portalRef.current.destroy();
        portalRef.current = null;
      }
    },
    [clearDragTimer, clearMenuTimer],
  );

  const scheduleSecondLevelMenu = useCallback(
    ({
      item,
      index,
      pageX,
      pageY,
    }: {
      item: IMarketToken;
      index: number;
      pageX: number;
      pageY: number;
    }) => {
      clearMenuTimer();
      gestureRef.current.menuObserveTimer = setInterval(() => {
        if (Math.abs(globalRef.translationY) >= DRAG_MOVE_THRESHOLD_PX) {
          gestureRef.current.movedBeyondThreshold = true;
        }
      }, 16);
      gestureRef.current.menuTimer = setTimeout(() => {
        const current = gestureRef.current;
        if (current.activeItemId !== item.id) return;
        if (!current.firstLevelTriggered) return;
        if (current.movedBeyondThreshold) return;
        if (Math.abs(globalRef.translationY) >= DRAG_MOVE_THRESHOLD_PX) {
          return;
        }

        globalRef.reset();
        setPreviewDraggingItemId(null);
        Haptics.impact(ImpactFeedbackStyle.Medium);
        handleShowContextMenu(item, index, { x: pageX, y: pageY });
      }, SECOND_LEVEL_MENU_DELAY_MS);
    },
    [clearMenuTimer, handleShowContextMenu],
  );

  const handleDragEnd = useCallback(
    ({
      from,
      to,
      data,
    }: {
      from: number;
      to: number;
      data: IMarketToken[];
    }) => {
      clearDragTimer();
      clearMenuTimer();
      gestureRef.current.activeItemId = '';
      gestureRef.current.firstLevelTriggered = false;
      gestureRef.current.movedBeyondThreshold = false;
      setPreviewDraggingItemId(null);

      if (from === to) return;
      const dragItem = data[to];
      if (!dragItem) return;

      const prevItem = data[to - 1];
      const nextItem = data[to + 1];
      void actions.current.sortWatchListV2Items({
        target: tokenToWatchListItem(dragItem),
        prev: prevItem ? tokenToWatchListItem(prevItem) : undefined,
        next: nextItem ? tokenToWatchListItem(nextItem) : undefined,
      });
    },
    [actions, clearDragTimer, clearMenuTimer, tokenToWatchListItem],
  );

  const renderItem = useCallback(
    ({
      item,
      getIndex,
      drag,
      isActive,
    }: {
      item: IMarketToken;
      getIndex: () => number | undefined;
      drag: () => void;
      isActive: boolean;
    }) => {
      const resolvedIndex = getIndex() ?? 0;
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
            clearDragTimer();
            clearMenuTimer();
            const { pageX = 0, pageY = 0 } = event.nativeEvent;
            const current = gestureRef.current;
            current.activeItemId = item.id;
            current.pressX = pageX;
            current.pressY = pageY;
            current.firstLevelTriggered = false;
            current.movedBeyondThreshold = false;
            current.consumeNextPress = false;
            current.dragTimer = setTimeout(() => {
              if (gestureRef.current.activeItemId !== item.id) {
                return;
              }
              gestureRef.current.firstLevelTriggered = true;
              gestureRef.current.consumeNextPress = true;
              setPreviewDraggingItemId(item.id);

              if (!drag) {
                setPreviewDraggingItemId(null);
                Haptics.impact(ImpactFeedbackStyle.Medium);
                handleShowContextMenu(item, resolvedIndex, {
                  x: pageX,
                  y: pageY,
                });
                return;
              }

              drag();
              Haptics.impact(ImpactFeedbackStyle.Medium);
              scheduleSecondLevelMenu({
                item,
                index: resolvedIndex,
                pageX,
                pageY,
              });
            }, FIRST_LEVEL_LONG_PRESS_DELAY_MS);
          }}
          onTouchMove={(event: GestureResponderEvent) => {
            const current = gestureRef.current;
            if (current.activeItemId !== item.id) {
              return;
            }
            const { pageX = 0, pageY = 0 } = event.nativeEvent;
            const deltaX = Math.abs(pageX - current.pressX);
            const deltaY = Math.abs(pageY - current.pressY);
            if (Math.max(deltaX, deltaY) > DRAG_MOVE_THRESHOLD_PX) {
              if (!current.firstLevelTriggered) {
                clearDragTimer();
                current.activeItemId = '';
                setPreviewDraggingItemId(null);
                return;
              }
              current.movedBeyondThreshold = true;
              clearMenuTimer();
            }

            if (current.firstLevelTriggered && isActive) {
              const { width, height } = Dimensions.get('window');
              const outOfBounds =
                pageX < 0 || pageX > width || pageY < 0 || pageY > height;
              if (outOfBounds) {
                gestureRef.current.consumeNextPress = true;
                clearDragTimer();
                clearMenuTimer();
                setPreviewDraggingItemId(null);
                globalRef.reset();
              }
            }
          }}
          onPressOut={() => {
            clearDragTimer();
            clearMenuTimer();
            setPreviewDraggingItemId(null);
            gestureRef.current.activeItemId = '';
            gestureRef.current.firstLevelTriggered = false;
          }}
          isDragging={isActive || previewDraggingItemId === item.id}
        />
      );
    },
    [
      clearDragTimer,
      clearMenuTimer,
      handleShowContextMenu,
      navigateToPerps,
      previewDraggingItemId,
      scheduleSecondLevelMenu,
      toMarketDetailPage,
    ],
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
      <Stack alignItems="center" justifyContent="center" p="$8" mt="$10">
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
    <DraggableFlatList<IMarketToken>
      showsVerticalScrollIndicator={false}
      data={showSkeleton ? EMPTY_DATA : filteredData}
      onDragEnd={handleDragEnd}
      onDragBegin={() => {
        gestureRef.current.consumeNextPress = true;
        clearDragTimer();
        clearMenuTimer();
        dismissInlineActionBar();
      }}
      activationDistance={DRAG_MOVE_THRESHOLD_PX}
      autoscrollThreshold={AUTOSCROLL_THRESHOLD_PX}
      autoscrollSpeed={AUTOSCROLL_SPEED_PX}
      renderItem={renderItem}
      keyExtractor={keyExtractor}
      getItemLayout={getItemLayout}
      initialNumToRender={15}
      maxToRenderPerBatch={20}
      windowSize={platformEnv.isNativeAndroid ? 7 : 3}
      removeClippedSubviews={platformEnv.isNativeIOS}
      onScrollBeginDrag={dismissInlineActionBar}
      ListEmptyComponent={ListEmptyComponent}
      contentContainerStyle={{
        paddingTop: 8 + (platformEnv.isNative ? 248 : 0),
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
