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
  topAutoScrollTriggerOffset?: number;
}

const EMPTY_DATA: IMarketToken[] = [];
const FIRST_LEVEL_LONG_PRESS_DELAY_MS = 800;
const SECOND_LEVEL_LONG_PRESS_DELAY_MS = 2000;
const DRAG_MOVE_THRESHOLD_PX = 10;
const DRAG_ACTIVATION_DISTANCE_PX = 0;
const PRESS_STATIONARY_THRESHOLD_PX = 3;
const DRAG_START_AFTER_PRIMED_MOVE_PX = 3;
const ROW_HEIGHT_FALLBACK_PX = 60;
const AUTOSCROLL_THRESHOLD_PX = 0;
const AUTOSCROLL_SPEED_PX = 0;
const MANUAL_AUTOSCROLL_TOP_EDGE_PX = 96;
const MANUAL_AUTOSCROLL_BOTTOM_EDGE_PX = 120;
const MANUAL_AUTOSCROLL_MIN_STEP_PX = 4;
const MANUAL_AUTOSCROLL_MAX_STEP_PX = 28;
const SECOND_LEVEL_MENU_ANCHOR_X_RATIO = 0.48;
const SECOND_LEVEL_MENU_ANCHOR_Y_OFFSET = 4;
const DRAG_END_FALLBACK_DELAY_MS = 220;
const DRAG_POINTER_TRACK_INTERVAL_MS = 16;
type IAutoScrollDirection = -1 | 0 | 1;
type IAutoScrollResolveResult = {
  direction: IAutoScrollDirection;
  step: number;
};

function getWatchlistViewportTopBoundaryY({
  viewportTop,
  headerBottomOffset,
}: {
  viewportTop: number;
  headerBottomOffset: number;
}) {
  return Math.max(0, viewportTop) + Math.max(0, headerBottomOffset);
}

function getDraggedItemTopY({
  anchorRowTopY,
  translationY,
}: {
  anchorRowTopY: number;
  translationY: number;
}) {
  return anchorRowTopY + translationY;
}

function MobileMarketWatchlistFlatListImpl({
  selectedFilter = 'all',
  listContainerProps,
  topAutoScrollTriggerOffset = 0,
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
  const DraggableFlatListComponent =
    (Tabs as any).DraggableFlatList ?? DraggableFlatList;
  const [primedItemId, setPrimedItemId] = useState<string | null>(null);
  const [dragResetNonce, setDragResetNonce] = useState(0);
  const rowHeightsRef = useRef<Record<string, number>>({});
  const listRef = useRef<{
    scrollToOffset: (params: { offset: number; animated?: boolean }) => void;
  } | null>(null);
  const scrollOffsetRef = useRef(0);
  const contentHeightRef = useRef(0);
  const viewportRef = useRef({
    top: 0,
    bottom: 0,
    height: 0,
  });
  const autoScrollRef = useRef<{
    timer: ReturnType<typeof setInterval> | null;
    direction: -1 | 0 | 1;
    step: number;
  }>({
    timer: null,
    direction: 0,
    step: 0,
  });
  const dragPointerTrackRef = useRef<{
    timer: ReturnType<typeof setInterval> | null;
    anchorRowTopY: number;
    dragItemHeight: number;
  }>({
    timer: null,
    anchorRowTopY: 0,
    dragItemHeight: ROW_HEIGHT_FALLBACK_PX,
  });

  const portalRef = useRef<IPortalManager | null>(null);
  const gestureRef = useRef<{
    activeItemId: string;
    pressX: number;
    pressY: number;
    pressStartAt: number;
    lastPageX: number;
    lastPageY: number;
    primedPageX: number;
    primedPageY: number;
    rowTop: number;
    rowBottom: number;
    firstLevelTriggered: boolean;
    movedBeyondThreshold: boolean;
    hasMoved: boolean;
    dragTimer: ReturnType<typeof setTimeout> | null;
    menuTimer: ReturnType<typeof setTimeout> | null;
    consumeNextPress: boolean;
  }>({
    activeItemId: '',
    pressX: 0,
    pressY: 0,
    pressStartAt: 0,
    lastPageX: 0,
    lastPageY: 0,
    primedPageX: 0,
    primedPageY: 0,
    rowTop: 0,
    rowBottom: 0,
    firstLevelTriggered: false,
    movedBeyondThreshold: false,
    hasMoved: false,
    dragTimer: null,
    menuTimer: null,
    consumeNextPress: false,
  });
  const isDragSessionActiveRef = useRef(false);
  const dragEndFallbackTimerRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );

  const getStableItemKey = useCallback(
    (item: IMarketToken) =>
      item.perpsCoin
        ? `perps:${item.perpsCoin}`
        : `${item.networkId}:${(item.address || '').toLowerCase()}:${item.isNative ? 1 : 0}`,
    [],
  );

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
  }, []);

  const clearDragEndFallbackTimer = useCallback(() => {
    if (dragEndFallbackTimerRef.current) {
      clearTimeout(dragEndFallbackTimerRef.current);
      dragEndFallbackTimerRef.current = null;
    }
  }, []);

  const resetGestureSession = useCallback(() => {
    gestureRef.current.activeItemId = '';
    gestureRef.current.firstLevelTriggered = false;
    gestureRef.current.movedBeyondThreshold = false;
    gestureRef.current.hasMoved = false;
    gestureRef.current.rowTop = 0;
    gestureRef.current.rowBottom = 0;
    gestureRef.current.pressStartAt = 0;
    gestureRef.current.lastPageX = 0;
    gestureRef.current.lastPageY = 0;
    gestureRef.current.primedPageX = 0;
    gestureRef.current.primedPageY = 0;
    setPrimedItemId(null);
  }, []);

  const stopManualAutoScroll = useCallback(() => {
    if (autoScrollRef.current.timer) {
      clearInterval(autoScrollRef.current.timer);
      autoScrollRef.current.timer = null;
    }
    autoScrollRef.current.direction = 0;
    autoScrollRef.current.step = 0;
  }, []);

  const startManualAutoScroll = useCallback(
    (direction: -1 | 1, step: number) => {
      const nextStep = Math.max(
        MANUAL_AUTOSCROLL_MIN_STEP_PX,
        Math.min(MANUAL_AUTOSCROLL_MAX_STEP_PX, step),
      );
      if (autoScrollRef.current.direction === direction) {
        autoScrollRef.current.step = nextStep;
        return;
      }

      stopManualAutoScroll();
      autoScrollRef.current.direction = direction;
      autoScrollRef.current.step = nextStep;
      autoScrollRef.current.timer = setInterval(() => {
        const viewportHeight = viewportRef.current.height;
        if (!viewportHeight) return;
        const maxOffset = Math.max(
          0,
          contentHeightRef.current - viewportHeight,
        );
        if (maxOffset <= 0) return;

        const nextOffset = Math.max(
          0,
          Math.min(
            maxOffset,
            scrollOffsetRef.current +
              autoScrollRef.current.direction * autoScrollRef.current.step,
          ),
        );
        if (nextOffset === scrollOffsetRef.current) return;

        scrollOffsetRef.current = nextOffset;
        listRef.current?.scrollToOffset({
          offset: nextOffset,
          animated: false,
        });
      }, 16);
    },
    [stopManualAutoScroll],
  );

  const resolveManualAutoScrollState = useCallback(
    ({
      dragItemTopY,
      dragItemBottomY,
    }: {
      dragItemTopY: number;
      dragItemBottomY: number;
    }): IAutoScrollResolveResult => {
      const { height } = Dimensions.get('window');
      const viewportTop =
        viewportRef.current.top > 0 ? viewportRef.current.top : 0;
      const viewportBottom =
        viewportRef.current.bottom > 0 ? viewportRef.current.bottom : height;
      const headerBottomY = getWatchlistViewportTopBoundaryY({
        viewportTop,
        headerBottomOffset: topAutoScrollTriggerOffset,
      });
      const distToTop = dragItemTopY - headerBottomY;
      const distToBottom = viewportBottom - dragItemBottomY;
      const normalizedDistToTop = Math.max(0, distToTop);
      const normalizedDistToBottom = Math.max(0, distToBottom);
      const topActive = distToTop <= MANUAL_AUTOSCROLL_TOP_EDGE_PX;
      const bottomActive = distToBottom <= MANUAL_AUTOSCROLL_BOTTOM_EDGE_PX;

      if (!topActive && !bottomActive) {
        return { direction: 0 as const, step: 0 };
      }

      const direction: -1 | 1 =
        topActive &&
        (!bottomActive || normalizedDistToTop <= normalizedDistToBottom)
          ? -1
          : 1;
      const distanceToEdge =
        direction === -1 ? normalizedDistToTop : normalizedDistToBottom;
      const edgePx =
        direction === -1
          ? MANUAL_AUTOSCROLL_TOP_EDGE_PX
          : MANUAL_AUTOSCROLL_BOTTOM_EDGE_PX;
      const clampedDistance = Math.max(0, Math.min(edgePx, distanceToEdge));
      const ratio = 1 - clampedDistance / edgePx;
      const easedRatio = ratio * ratio;
      const step = Math.round(
        MANUAL_AUTOSCROLL_MIN_STEP_PX +
          (MANUAL_AUTOSCROLL_MAX_STEP_PX - MANUAL_AUTOSCROLL_MIN_STEP_PX) *
            easedRatio,
      );

      return {
        direction,
        step: Math.max(
          MANUAL_AUTOSCROLL_MIN_STEP_PX,
          Math.min(MANUAL_AUTOSCROLL_MAX_STEP_PX, step),
        ),
      };
    },
    [topAutoScrollTriggerOffset],
  );

  const updateManualAutoScroll = useCallback(
    ({
      dragItemTopY,
      dragItemBottomY,
    }: {
      dragItemTopY: number;
      dragItemBottomY: number;
    }) => {
      const { direction, step } = resolveManualAutoScrollState({
        dragItemTopY,
        dragItemBottomY,
      });
      if (direction === 0 || step <= 0) {
        stopManualAutoScroll();
        return;
      }
      startManualAutoScroll(direction, step);
    },
    [resolveManualAutoScrollState, startManualAutoScroll, stopManualAutoScroll],
  );

  const stopDragPointerTracking = useCallback(() => {
    if (dragPointerTrackRef.current.timer) {
      clearInterval(dragPointerTrackRef.current.timer);
      dragPointerTrackRef.current.timer = null;
    }
    dragPointerTrackRef.current.anchorRowTopY = 0;
    dragPointerTrackRef.current.dragItemHeight = ROW_HEIGHT_FALLBACK_PX;
  }, []);

  const syncDragItemAnchor = useCallback(() => {
    const rowTop = gestureRef.current.rowTop;
    const rowHeight = Math.max(
      ROW_HEIGHT_FALLBACK_PX,
      gestureRef.current.rowBottom - gestureRef.current.rowTop,
    );
    if (rowTop <= 0) {
      return false;
    }
    dragPointerTrackRef.current.anchorRowTopY = rowTop;
    dragPointerTrackRef.current.dragItemHeight = rowHeight;
    return true;
  }, []);

  const startDragPointerTracking = useCallback(() => {
    if (dragPointerTrackRef.current.timer) {
      return;
    }
    dragPointerTrackRef.current.timer = setInterval(() => {
      if (!isDragSessionActiveRef.current) {
        return;
      }
      const anchorRowTopY = dragPointerTrackRef.current.anchorRowTopY;
      if (anchorRowTopY <= 0) {
        return;
      }
      const dragItemTopY = getDraggedItemTopY({
        anchorRowTopY,
        translationY: globalRef.translationY,
      });
      updateManualAutoScroll({
        dragItemTopY,
        dragItemBottomY:
          dragItemTopY + dragPointerTrackRef.current.dragItemHeight,
      });
    }, DRAG_POINTER_TRACK_INTERVAL_MS);
  }, [updateManualAutoScroll]);

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

  const finalizeDragSession = useCallback(() => {
    clearDragEndFallbackTimer();
    isDragSessionActiveRef.current = false;
    stopDragPointerTracking();
    clearDragTimer();
    clearMenuTimer();
    stopManualAutoScroll();
    resetGestureSession();
    globalRef.reset();
  }, [
    clearDragEndFallbackTimer,
    clearDragTimer,
    clearMenuTimer,
    resetGestureSession,
    stopDragPointerTracking,
    stopManualAutoScroll,
  ]);

  const scheduleDragEndFallback = useCallback(() => {
    if (!platformEnv.isNativeAndroid || !isDragSessionActiveRef.current) {
      return;
    }
    clearDragEndFallbackTimer();
    dragEndFallbackTimerRef.current = setTimeout(() => {
      if (!isDragSessionActiveRef.current) {
        return;
      }
      setDragResetNonce((prev) => prev + 1);
      finalizeDragSession();
    }, DRAG_END_FALLBACK_DELAY_MS);
  }, [clearDragEndFallbackTimer, finalizeDragSession]);

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
      clearDragEndFallbackTimer();
      stopDragPointerTracking();
      clearDragTimer();
      clearMenuTimer();
      stopManualAutoScroll();
      resetGestureSession();
      if (portalRef.current) {
        portalRef.current.destroy();
        portalRef.current = null;
      }
    },
    [
      clearDragEndFallbackTimer,
      clearDragTimer,
      clearMenuTimer,
      resetGestureSession,
      stopDragPointerTracking,
      stopManualAutoScroll,
    ],
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
      clearDragEndFallbackTimer();
      finalizeDragSession();
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
    [
      actions,
      clearDragEndFallbackTimer,
      finalizeDragSession,
      tokenToWatchListItem,
    ],
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
      const itemKey = getStableItemKey(item);
      const startDragWithGuard = (startDrag?: () => void) => {
        if (!startDrag) {
          return false;
        }
        if (
          isDragSessionActiveRef.current ||
          gestureRef.current.movedBeyondThreshold
        ) {
          return true;
        }
        clearMenuTimer();
        gestureRef.current.movedBeyondThreshold = true;
        gestureRef.current.consumeNextPress = true;
        setPrimedItemId(null);
        startDrag();
        if (!isDragSessionActiveRef.current) {
          gestureRef.current.movedBeyondThreshold = false;
          gestureRef.current.consumeNextPress = false;
          return false;
        }
        Haptics.impact(ImpactFeedbackStyle.Medium);
        return true;
      };
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
            clearDragEndFallbackTimer();
            clearDragTimer();
            clearMenuTimer();
            isDragSessionActiveRef.current = false;
            const {
              pageX = 0,
              pageY = 0,
              locationY = ROW_HEIGHT_FALLBACK_PX / 2,
            } = event.nativeEvent;
            const getLatestIndex = () => getIndex() ?? resolvedIndex;
            const current = gestureRef.current;
            const rowHeight =
              rowHeightsRef.current[itemKey] ?? ROW_HEIGHT_FALLBACK_PX;
            const rowTop = pageY - locationY;
            globalRef.reset();
            current.activeItemId = itemKey;
            current.pressX = pageX;
            current.pressY = pageY;
            current.pressStartAt = Date.now();
            current.lastPageX = pageX;
            current.lastPageY = pageY;
            current.primedPageX = pageX;
            current.primedPageY = pageY;
            current.rowTop = rowTop;
            current.rowBottom = rowTop + rowHeight;
            current.firstLevelTriggered = false;
            current.movedBeyondThreshold = false;
            current.hasMoved = false;
            current.consumeNextPress = false;
            current.dragTimer = setTimeout(() => {
              if (gestureRef.current.activeItemId !== itemKey) {
                return;
              }
              gestureRef.current.firstLevelTriggered = true;
              gestureRef.current.primedPageX = gestureRef.current.lastPageX;
              gestureRef.current.primedPageY = gestureRef.current.lastPageY;
              setPrimedItemId(itemKey);
            }, FIRST_LEVEL_LONG_PRESS_DELAY_MS);
            current.menuTimer = setTimeout(() => {
              const latest = gestureRef.current;
              if (latest.activeItemId !== itemKey) {
                return;
              }
              if (
                isDragSessionActiveRef.current ||
                latest.movedBeyondThreshold ||
                !latest.firstLevelTriggered ||
                latest.hasMoved
              ) {
                return;
              }

              const latestPageY = latest.lastPageY || pageY;
              const stillInsideRow =
                latestPageY >= latest.rowTop && latestPageY <= latest.rowBottom;
              if (!stillInsideRow) {
                return;
              }

              latest.consumeNextPress = true;
              clearDragTimer();
              clearMenuTimer();
              stopManualAutoScroll();
              setPrimedItemId(null);
              const latestIndex = getLatestIndex();
              Haptics.impact(ImpactFeedbackStyle.Medium);
              const { width } = Dimensions.get('window');
              handleShowContextMenu(item, latestIndex, {
                x: width * SECOND_LEVEL_MENU_ANCHOR_X_RATIO,
                y: latestPageY - SECOND_LEVEL_MENU_ANCHOR_Y_OFFSET,
              });
              resetGestureSession();
            }, SECOND_LEVEL_LONG_PRESS_DELAY_MS);
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

            if (!current.firstLevelTriggered) {
              const pressedFor = Date.now() - current.pressStartAt;
              if (pressedFor >= FIRST_LEVEL_LONG_PRESS_DELAY_MS) {
                current.firstLevelTriggered = true;
                current.primedPageX = pageX;
                current.primedPageY = pageY;
                setPrimedItemId(itemKey);
              }
              stopManualAutoScroll();
              if (!current.firstLevelTriggered) {
                return;
              }
            }

            if (!isActive && !current.movedBeyondThreshold) {
              const movedAfterPrimed = Math.max(
                Math.abs(pageX - current.primedPageX),
                Math.abs(pageY - current.primedPageY),
              );
              if (movedAfterPrimed) {
                if (
                  movedAfterPrimed >= DRAG_START_AFTER_PRIMED_MOVE_PX &&
                  startDragWithGuard(drag)
                ) {
                  return;
                }
              }
            }

            if (movedDistance > DRAG_MOVE_THRESHOLD_PX) {
              clearMenuTimer();
            }

            if (current.firstLevelTriggered && isActive) {
              const dragItemTopY = getDraggedItemTopY({
                anchorRowTopY:
                  dragPointerTrackRef.current.anchorRowTopY || current.rowTop,
                translationY: globalRef.translationY,
              });
              updateManualAutoScroll({
                dragItemTopY,
                dragItemBottomY:
                  dragItemTopY + (current.rowBottom - current.rowTop),
              });
            } else {
              stopManualAutoScroll();
            }
          }}
          onLayout={(layoutEvent) => {
            rowHeightsRef.current[itemKey] =
              layoutEvent.nativeEvent.layout.height || ROW_HEIGHT_FALLBACK_PX;
          }}
          onPressOut={(event: GestureResponderEvent) => {
            if (isDragSessionActiveRef.current || isActive) {
              return;
            }
            const touchesLength = event.nativeEvent.touches?.length ?? 0;
            if (touchesLength > 0) {
              return;
            }
            clearDragTimer();
            clearMenuTimer();
            stopManualAutoScroll();
            resetGestureSession();
          }}
          onTouchEnd={() => {
            if (isDragSessionActiveRef.current || isActive) {
              stopDragPointerTracking();
              stopManualAutoScroll();
              scheduleDragEndFallback();
              return;
            }
            gestureRef.current.consumeNextPress = false;
            clearDragTimer();
            clearMenuTimer();
            stopManualAutoScroll();
            resetGestureSession();
          }}
          isPrimed={primedItemId === itemKey ? !isActive : false}
          isDragging={isActive}
        />
      );
    },
    [
      clearDragTimer,
      clearMenuTimer,
      clearDragEndFallbackTimer,
      getStableItemKey,
      handleShowContextMenu,
      navigateToPerps,
      primedItemId,
      resetGestureSession,
      stopDragPointerTracking,
      stopManualAutoScroll,
      updateManualAutoScroll,
      scheduleDragEndFallback,
      toMarketDetailPage,
    ],
  );

  const keyExtractor = useCallback(
    (item: IMarketToken) => getStableItemKey(item),
    [getStableItemKey],
  );

  const renderPlaceholder = useCallback(
    () => <Stack pointerEvents="none" h={0} opacity={0} />,
    [],
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
    <DraggableFlatListComponent
      key={`watchlist-drag-${dragResetNonce}`}
      ref={listRef as any}
      showsVerticalScrollIndicator={false}
      data={showSkeleton ? EMPTY_DATA : filteredData}
      onDragEnd={handleDragEnd}
      onRelease={() => {
        stopDragPointerTracking();
        stopManualAutoScroll();
        scheduleDragEndFallback();
      }}
      onDragBegin={() => {
        clearDragEndFallbackTimer();
        isDragSessionActiveRef.current = true;
        gestureRef.current.consumeNextPress = true;
        clearDragTimer();
        clearMenuTimer();
        stopManualAutoScroll();
        setPrimedItemId(null);
        dismissInlineActionBar();
        if (syncDragItemAnchor()) {
          startDragPointerTracking();
          const dragItemTopY = getDraggedItemTopY({
            anchorRowTopY: dragPointerTrackRef.current.anchorRowTopY,
            translationY: globalRef.translationY,
          });
          updateManualAutoScroll({
            dragItemTopY,
            dragItemBottomY:
              dragItemTopY + dragPointerTrackRef.current.dragItemHeight,
          });
        }
      }}
      onScrollOffsetChange={(offset: number) => {
        scrollOffsetRef.current = offset;
      }}
      onContentSizeChange={(_: number, height: number) => {
        contentHeightRef.current = height;
      }}
      onContainerLayout={({ layout, containerRef }: any) => {
        viewportRef.current.height =
          layout?.height ?? viewportRef.current.height;
        const target = containerRef?.current as
          | {
              measureInWindow?: (
                callback: (x: number, y: number, w: number, h: number) => void,
              ) => void;
            }
          | undefined;
        target?.measureInWindow?.((_x, y, _w, h) => {
          viewportRef.current.top = y;
          viewportRef.current.bottom = y + h;
          viewportRef.current.height = h;
        });
      }}
      activationDistance={DRAG_ACTIVATION_DISTANCE_PX}
      autoscrollThreshold={AUTOSCROLL_THRESHOLD_PX}
      autoscrollSpeed={AUTOSCROLL_SPEED_PX}
      scrollEnabled={!primedItemId}
      renderItem={renderItem}
      renderPlaceholder={renderPlaceholder}
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
