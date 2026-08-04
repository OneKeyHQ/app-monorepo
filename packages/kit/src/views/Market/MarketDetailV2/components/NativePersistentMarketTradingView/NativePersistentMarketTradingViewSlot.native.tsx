import { useCallback, useEffect, useMemo, useRef } from 'react';

import { View } from 'react-native';
import { useTabsContext } from 'react-native-collapsible-tab-view';
import { runOnUI, scrollTo } from 'react-native-reanimated';
import { useTransitionProgress } from 'react-native-screens';

import { useCurrentTabScrollY } from '@onekeyhq/components';
import { useRouteIsFocused } from '@onekeyhq/kit/src/hooks/useRouteIsFocused';
import { useTokenDetailActions } from '@onekeyhq/kit/src/states/jotai/contexts/marketV2';

import { useNetworkAccountAddress } from '../InformationTabs/hooks/useNetworkAccountAddress';

import {
  activateNativeMarketTradingViewSession,
  createNativeMarketTradingViewSessionId,
  deactivateNativeMarketTradingViewSession,
  finalizeNativeMarketTradingViewHostReleaseIfRequested,
  updateNativeMarketTradingViewSessionFrame,
  updateNativeMarketTradingViewSessionProps,
} from './nativeMarketTradingViewHostStore';

import type { INativeMarketTradingViewSession } from './nativeMarketTradingViewHostStore';
import type {
  IMarketTradingViewPriceUpdate,
  IMarketTradingViewProps,
} from '../MarketTradingView/MarketTradingView';
import type { RefComponent } from 'react-native-collapsible-tab-view';
import type { AnimatedRef, SharedValue } from 'react-native-reanimated';

function scrollPersistentChartTabOnUI({
  ref,
  scrollY,
  offset,
}: {
  ref: AnimatedRef<RefComponent>;
  scrollY: SharedValue<number>;
  offset: number;
}) {
  'worklet';

  const nextScrollY = Math.max(0, scrollY.value + offset);
  scrollY.value = nextScrollY;
  scrollTo(ref, 0, nextScrollY, false);
}

export function NativePersistentMarketTradingViewSlot({
  clipTop,
  isChartPageVisible,
  tradingViewProps,
}: {
  clipTop: number;
  isChartPageVisible: boolean;
  tradingViewProps: IMarketTradingViewProps;
}) {
  const isRouteFocused = useRouteIsFocused();
  const isActive = isRouteFocused && isChartPageVisible;
  const { progress: transitionProgress } = useTransitionProgress();
  const scrollY = useCurrentTabScrollY();
  const { focusedTab, refMap } = useTabsContext();
  const { accountAddress } = useNetworkAccountAddress(
    tradingViewProps.networkId,
  );
  const onTouchScroll = tradingViewProps.onTouchScroll;
  const tokenDetailActions = useTokenDetailActions();
  const slotRef = useRef<View>(null);
  const isActiveRef = useRef(isActive);
  const isRouteFocusedRef = useRef(isRouteFocused);
  const clipTopRef = useRef(clipTop);
  const tradingViewPropsRef = useRef(tradingViewProps);
  const sessionIdRef = useRef<number | undefined>(undefined);
  isActiveRef.current = isActive;
  isRouteFocusedRef.current = isRouteFocused;
  clipTopRef.current = clipTop;
  tradingViewPropsRef.current = tradingViewProps;
  if (sessionIdRef.current === undefined) {
    sessionIdRef.current = createNativeMarketTradingViewSessionId();
  }
  const sessionId = sessionIdRef.current;
  const handleApplyChartPriceUpdate = useCallback(
    (update: IMarketTradingViewPriceUpdate) => {
      tokenDetailActions.current.applyChartPriceUpdate(update);
    },
    [tokenDetailActions],
  );
  const handleTouchScroll = useCallback(
    (deltaY: number) => {
      const activeTabRef = refMap[focusedTab.value];
      if (!activeTabRef) {
        return;
      }
      runOnUI(scrollPersistentChartTabOnUI)({
        ref: activeTabRef,
        scrollY,
        offset: deltaY,
      });
      onTouchScroll?.(deltaY);
    },
    [focusedTab, onTouchScroll, refMap, scrollY],
  );
  const persistentTradingViewProps = useMemo(
    () => ({
      ...tradingViewProps,
      accountAddress,
      onApplyChartPriceUpdate: handleApplyChartPriceUpdate,
      onTouchScroll: handleTouchScroll,
    }),
    [
      accountAddress,
      handleApplyChartPriceUpdate,
      handleTouchScroll,
      tradingViewProps,
    ],
  );
  const sessionRef = useRef<INativeMarketTradingViewSession>({
    id: sessionId,
    props: persistentTradingViewProps,
    scrollY,
    transitionProgress,
  });
  sessionRef.current = {
    id: sessionId,
    props: persistentTradingViewProps,
    scrollY,
    transitionProgress,
  };

  const measureSlot = useCallback(() => {
    if (!isActiveRef.current) {
      return;
    }
    slotRef.current?.measureInWindow((x, y, width, height) => {
      if (width <= 0 || height <= 0) {
        return;
      }
      updateNativeMarketTradingViewSessionFrame({
        id: sessionId,
        frame: {
          anchorX: x,
          anchorY: y + scrollY.value,
          width,
          height,
          clipTop: clipTopRef.current,
        },
      });
    });
  }, [scrollY, sessionId]);

  useEffect(() => {
    if (!isActive) {
      deactivateNativeMarketTradingViewSession(sessionId);
      if (!isRouteFocused) {
        finalizeNativeMarketTradingViewHostReleaseIfRequested();
      }
      return undefined;
    }

    activateNativeMarketTradingViewSession(sessionRef.current);
    const frame = requestAnimationFrame(measureSlot);
    return () => {
      cancelAnimationFrame(frame);
      const latestTradingViewProps = tradingViewPropsRef.current;
      latestTradingViewProps.onIndicatorsDialogOpenChange?.(false);
      latestTradingViewProps.onInteractionOverlayOpenChange?.(false);
      latestTradingViewProps.onNativeIndicatorQuickBarChange?.(null);
      deactivateNativeMarketTradingViewSession(sessionId);
      if (!isRouteFocusedRef.current) {
        finalizeNativeMarketTradingViewHostReleaseIfRequested();
      }
    };
  }, [isActive, isRouteFocused, measureSlot, sessionId]);

  useEffect(
    () => () => {
      deactivateNativeMarketTradingViewSession(sessionId);
      finalizeNativeMarketTradingViewHostReleaseIfRequested();
    },
    [sessionId],
  );

  useEffect(() => {
    if (!isActive) {
      return undefined;
    }
    updateNativeMarketTradingViewSessionProps({
      id: sessionId,
      props: persistentTradingViewProps,
    });
    return undefined;
  }, [isActive, persistentTradingViewProps, sessionId]);

  return (
    <View
      ref={slotRef}
      collapsable={false}
      pointerEvents="none"
      style={{ flex: 1 }}
      onLayout={measureSlot}
    />
  );
}
