import type { IMarketTradingViewViewProps } from '../MarketTradingView/MarketTradingView';
import type { Animated } from 'react-native';
import type { SharedValue } from 'react-native-reanimated';

export interface INativeMarketTradingViewFrame {
  anchorX: number;
  anchorY: number;
  width: number;
  height: number;
  clipTop: number;
}

export interface INativeMarketTradingViewSession {
  id: number;
  frame?: INativeMarketTradingViewFrame;
  props: IMarketTradingViewViewProps;
  scrollY: SharedValue<number>;
  transitionProgress?: Animated.Value;
}

interface INativeMarketTradingViewHostSnapshot {
  activeSession?: INativeMarketTradingViewSession;
  lastProps?: IMarketTradingViewViewProps;
  mountRequested: boolean;
}

const listeners = new Set<() => void>();
let nextSessionId = 0;
let snapshot: INativeMarketTradingViewHostSnapshot = {
  mountRequested: false,
};
let releaseRequested = false;

function emitChange() {
  listeners.forEach((listener) => listener());
}

function removeSessionCallbacks(
  props: IMarketTradingViewViewProps,
): IMarketTradingViewViewProps {
  return {
    ...props,
    onTouchScroll: undefined,
    onNativeChartFullscreenChange: undefined,
    onNativeIndicatorQuickBarChange: undefined,
    onIndicatorsDialogOpenChange: undefined,
    onInteractionOverlayOpenChange: undefined,
    onNativeSubIndicatorCountChange: undefined,
    onPanesCountChange: undefined,
    onApplyChartPriceUpdate: undefined,
  };
}

export function createNativeMarketTradingViewSessionId() {
  nextSessionId += 1;
  return nextSessionId;
}

export function subscribeNativeMarketTradingViewHost(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getNativeMarketTradingViewHostSnapshot() {
  return snapshot;
}

export function requestNativeMarketTradingViewWarmup() {
  releaseRequested = false;
  if (snapshot.mountRequested) {
    return;
  }
  snapshot = {
    ...snapshot,
    mountRequested: true,
  };
  emitChange();
}

export function activateNativeMarketTradingViewSession(
  session: INativeMarketTradingViewSession,
) {
  snapshot = {
    activeSession: session,
    lastProps: session.props,
    mountRequested: true,
  };
  emitChange();
}

export function updateNativeMarketTradingViewSessionFrame({
  id,
  frame,
}: {
  id: number;
  frame: INativeMarketTradingViewFrame;
}) {
  if (snapshot.activeSession?.id !== id) {
    return;
  }
  snapshot = {
    ...snapshot,
    activeSession: {
      ...snapshot.activeSession,
      frame,
    },
  };
  emitChange();
}

export function updateNativeMarketTradingViewSessionProps({
  id,
  props,
}: {
  id: number;
  props: IMarketTradingViewViewProps;
}) {
  if (snapshot.activeSession?.id !== id) {
    return;
  }
  snapshot = {
    ...snapshot,
    activeSession: {
      ...snapshot.activeSession,
      props,
    },
    lastProps: props,
  };
  emitChange();
}

export function deactivateNativeMarketTradingViewSession(id: number) {
  if (snapshot.activeSession?.id !== id) {
    return;
  }
  snapshot = {
    activeSession: undefined,
    lastProps: removeSessionCallbacks(snapshot.activeSession.props),
    mountRequested: true,
  };
  emitChange();
}

export function finalizeNativeMarketTradingViewHostReleaseIfRequested() {
  if (!releaseRequested || snapshot.activeSession) {
    return;
  }
  releaseRequested = false;
  snapshot = {
    activeSession: undefined,
    lastProps: undefined,
    mountRequested: false,
  };
  emitChange();
}

export function releaseNativeMarketTradingViewHostIfInactive() {
  if (snapshot.activeSession) {
    releaseRequested = true;
    return;
  }
  releaseRequested = false;
  snapshot = {
    activeSession: undefined,
    lastProps: undefined,
    mountRequested: false,
  };
  emitChange();
}

export function resetNativeMarketTradingViewHostForTest() {
  nextSessionId = 0;
  releaseRequested = false;
  snapshot = {
    mountRequested: false,
  };
  emitChange();
}
