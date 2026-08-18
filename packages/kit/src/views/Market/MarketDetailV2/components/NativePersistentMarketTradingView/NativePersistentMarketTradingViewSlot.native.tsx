import { useCallback, useContext, useEffect, useMemo, useRef } from 'react';

import { View } from 'react-native';
import { useTransitionProgress } from 'react-native-screens';

import {
  CollapsibleTabContext,
  useCurrentTabScrollY,
} from '@onekeyhq/components';
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

export function NativePersistentMarketTradingViewSlot({
  clipTop,
  isChartPageVisible,
  scrollGestureProps,
  tradingViewProps,
}: {
  clipTop: number;
  isChartPageVisible: boolean;
  scrollGestureProps?: INativeMarketTradingViewSession['scrollGestureProps'];
  tradingViewProps: IMarketTradingViewProps;
}) {
  const isRouteFocused = useRouteIsFocused();
  const isActive = isRouteFocused && isChartPageVisible;
  const { progress: transitionProgress } = useTransitionProgress();
  const scrollY = useCurrentTabScrollY();
  const tabsContext = useContext(CollapsibleTabContext);
  const { accountAddress } = useNetworkAccountAddress(
    tradingViewProps.networkId,
  );
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
  const persistentTradingViewProps = useMemo(
    () => ({
      ...tradingViewProps,
      accountAddress,
      onApplyChartPriceUpdate: handleApplyChartPriceUpdate,
      onTouchScroll: undefined,
    }),
    [accountAddress, handleApplyChartPriceUpdate, tradingViewProps],
  );
  const sessionRef = useRef<INativeMarketTradingViewSession>({
    id: sessionId,
    props: persistentTradingViewProps,
    scrollY,
    transitionProgress,
    tabsContext,
    scrollGestureProps,
  });
  sessionRef.current = {
    id: sessionId,
    props: persistentTradingViewProps,
    scrollY,
    transitionProgress,
    tabsContext,
    scrollGestureProps,
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
      tabsContext,
      scrollGestureProps,
    });
    return undefined;
  }, [
    isActive,
    persistentTradingViewProps,
    scrollGestureProps,
    sessionId,
    tabsContext,
  ]);

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
