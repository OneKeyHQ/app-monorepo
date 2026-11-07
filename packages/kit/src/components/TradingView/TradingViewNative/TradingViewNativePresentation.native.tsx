import {
  memo,
  useCallback,
  useContext,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useSyncExternalStore,
} from 'react';
import type { ReactNode } from 'react';

import { OverlayView } from '@onekeyfe/react-native-native-overlay';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import Animated, {
  measure,
  useAnimatedRef,
  useAnimatedStyle,
  useFrameCallback,
  useSharedValue,
} from 'react-native-reanimated';
import {
  useSafeAreaFrame,
  useSafeAreaInsets,
} from 'react-native-safe-area-context';

import { Stack } from '@onekeyhq/components';

import { TradingViewNativeChartActiveContext } from './TradingViewNativeChartActiveContext';
import { TradingViewNativeChartReadyContext } from './TradingViewNativeChartReadyContext';
import { TradingViewNativeFullscreenTransitionContext } from './TradingViewNativeFullscreenTransitionContext';

import type {
  IPushTradingViewNativeFullscreenModal,
  ITradingViewNativePresentationProps,
} from './TradingViewNativePresentation';
import type { SharedValue } from 'react-native-reanimated';

export const pushTradingViewNativeFullscreenModal: IPushTradingViewNativeFullscreenModal =
  () => false;

interface IFullscreenLayer {
  content: ReactNode;
  isRevealed: boolean;
  isLandscapeLayout: boolean;
  isStatusBarHidden: boolean;
  layerOpacity?: SharedValue<number>;
  revealOnLandscape?: SharedValue<boolean>;
  onReady?: () => void;
}

function getLayerSize(
  frame: { width: number; height: number },
  isLandscapeLayout: boolean,
) {
  if (!isLandscapeLayout) {
    return { width: frame.width, height: frame.height };
  }
  return {
    width: Math.max(frame.width, frame.height),
    height: Math.min(frame.width, frame.height),
  };
}

// The host sits inside the app's providers, so their safe-area insets apply;
// a nested SafeAreaProvider would render nothing until its own native view
// reports insets from inside the overlay window. Their frame sizes the layer:
// the overlay lays content out at the window size, but its host is the app's
// content view, which stops at a side navigation bar in landscape.
const FullscreenChart = memo(({ layer }: { layer: IFullscreenLayer }) => {
  const insets = useSafeAreaInsets();
  const frame = useSafeAreaFrame();
  const {
    content,
    isLandscapeLayout,
    isRevealed,
    isStatusBarHidden,
    layerOpacity,
    onReady,
  } = layer;
  const shownOpacity = useSharedValue(1);
  const opacity = layerOpacity ?? shownOpacity;
  const opacityStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));
  // A layer that rotates the window is laid out at the landscape size from
  // the start, so its chart has drawn at that size by the first landscape
  // frame, whenever the new window size reaches JS. Until then the portrait
  // side insets do not carry over; the bottom one approximates the gesture
  // bar, which stays at the bottom.
  const isAwaitingRotation = isLandscapeLayout && frame.width < frame.height;
  const { width, height } = getLayerSize(frame, isLandscapeLayout);
  return (
    <Animated.View
      style={[
        { position: 'absolute', top: 0, left: 0, width, height },
        opacityStyle,
      ]}
      pointerEvents={isRevealed ? 'auto' : 'none'}
      collapsable={false}
      accessibilityViewIsModal={isRevealed}
      importantForAccessibility={isRevealed ? 'auto' : 'no-hide-descendants'}
    >
      <Stack
        flex={1}
        bg="$bgApp"
        collapsable={false}
        testID="trading-view-native-fullscreen-layer"
      >
        <GestureHandlerRootView
          style={{
            flex: 1,
            paddingTop: isStatusBarHidden ? 0 : insets.top,
            paddingRight: isAwaitingRotation ? 0 : insets.right,
            paddingBottom: insets.bottom,
            paddingLeft: isAwaitingRotation ? 0 : insets.left,
          }}
        >
          {/* Stays set after the reveal, so revealing re-renders no chart. */}
          <TradingViewNativeChartReadyContext.Provider value={onReady}>
            {content}
          </TradingViewNativeChartReadyContext.Provider>
        </GestureHandlerRootView>
      </Stack>
    </Animated.View>
  );
});
FullscreenChart.displayName = 'FullscreenChart';

const layers = new Map<string, IFullscreenLayer>();
const listeners = new Set<() => void>();
let snapshot: { id: string; layer: IFullscreenLayer }[] = [];

function isSameLayer(a: IFullscreenLayer | undefined, b: IFullscreenLayer) {
  if (!a) {
    return false;
  }
  return (
    a.content === b.content &&
    a.isRevealed === b.isRevealed &&
    a.isLandscapeLayout === b.isLandscapeLayout &&
    a.isStatusBarHidden === b.isStatusBarHidden &&
    a.layerOpacity === b.layerOpacity &&
    a.revealOnLandscape === b.revealOnLandscape &&
    a.onReady === b.onReady
  );
}

function updateLayer(id: string, layer: IFullscreenLayer | null) {
  if (layer === null) {
    if (!layers.delete(id)) {
      return;
    }
  } else {
    if (isSameLayer(layers.get(id), layer)) {
      return;
    }
    layers.set(id, layer);
  }
  snapshot = Array.from(layers, ([layerId, value]) => ({
    id: layerId,
    layer: value,
  }));
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function getSnapshot() {
  return snapshot;
}

const FULLSCREEN_HOST_ANIMATION = { enter: { type: 'none' } } as const;
const WINDOW_PROBE_STYLE = {
  position: 'absolute',
  top: 0,
  right: 0,
  bottom: 0,
  left: 0,
} as const;

// The chart owner's page freezes while its chart is fullscreen, so the chart
// cannot present from inside it: the owner hands its content to this host
// (mounted with the app's overlays), which presents it in a native `modal`
// overlay. `useSyncExternalStore` keeps the hand-off in the owner's layout
// commit, so the inline and fullscreen charts switch activity together. The
// chart wrapper decides when the layer is shown and the window rotates.
// Non-blocking and not dismissed by back: back keeps reaching the page, and
// the chart's own control exits.
export function TradingViewNativeFullscreenHost() {
  const activeLayers = useSyncExternalStore(
    subscribe,
    getSnapshot,
    getSnapshot,
  );
  const frame = useSafeAreaFrame();
  // The overlay sizes its content to the window size JS last saw and clips
  // it there; a layer that rotates the window keeps its landscape size, so the
  // first landscape frame shows all of it.
  const landscapeContentSize = useMemo(
    () => getLayerSize(frame, true),
    [frame],
  );
  // Fills the app root, which native layout resizes in the frame the window
  // rotates, before JS hears about it.
  const windowProbeRef = useAnimatedRef<Animated.View>();
  const pendingReveals = useMemo(
    () =>
      activeLayers.flatMap(({ layer }) =>
        layer.isLandscapeLayout &&
        !layer.isRevealed &&
        layer.revealOnLandscape &&
        layer.layerOpacity
          ? [{ request: layer.revealOnLandscape, opacity: layer.layerOpacity }]
          : [],
      ),
    [activeLayers],
  );
  const revealOnLandscape = useCallback(() => {
    'worklet';

    const requested = pendingReveals.filter(({ request }) => request.value);
    if (requested.length === 0) {
      return;
    }
    const window = measure(windowProbeRef);
    if (!window || window.width <= window.height) {
      return;
    }
    requested.forEach(({ request, opacity }) => {
      request.value = false;
      opacity.value = 1;
    });
  }, [pendingReveals, windowProbeRef]);
  const revealFrameCallback = useFrameCallback(revealOnLandscape, false);
  const hasPendingReveals = pendingReveals.length > 0;
  useEffect(() => {
    revealFrameCallback.setActive(hasPendingReveals);
  }, [hasPendingReveals, revealFrameCallback]);
  const layerViews = activeLayers.map(({ id, layer }) => (
    <OverlayView
      key={id}
      visible
      level="modal"
      presentation="fullscreen"
      animation={FULLSCREEN_HOST_ANIMATION}
      blocking={false}
      backdrop={false}
      dismissOnBackPress={false}
      contentSize={layer.isLandscapeLayout ? landscapeContentSize : undefined}
    >
      <FullscreenChart layer={layer} />
    </OverlayView>
  ));
  return (
    <>
      {hasPendingReveals ? (
        <Animated.View
          ref={windowProbeRef}
          collapsable={false}
          pointerEvents="none"
          style={WINDOW_PROBE_STYLE}
        />
      ) : null}
      {layerViews}
    </>
  );
}

export function TradingViewNativePresentation({
  children,
  isFullscreen,
}: ITradingViewNativePresentationProps) {
  const id = useId();
  const transition = useContext(TradingViewNativeFullscreenTransitionContext);
  const isRevealed = transition?.isRevealed ?? true;
  const isLandscapeLayout = transition?.isLandscapeLayout ?? false;
  const isStatusBarHidden = transition?.isStatusBarHidden ?? false;
  const layerOpacity = transition?.layerOpacity;
  const revealOnLandscape = transition?.revealOnLandscape;
  const onReady = transition?.onLayerReady;
  // The inline chart stays mounted, unchanged, under the fullscreen layer: the
  // page keeps showing it while the layer prepares, and exiting returns to it
  // without remounting the chart. An owner mounted in fullscreen has no inline
  // chart until it exits.
  const inline = useRef<ReactNode>(isFullscreen ? null : children);
  if (!isFullscreen) inline.current = children;

  useLayoutEffect(() => {
    updateLayer(
      id,
      isFullscreen
        ? {
            content: children,
            isRevealed,
            isLandscapeLayout,
            isStatusBarHidden,
            layerOpacity,
            revealOnLandscape,
            onReady,
          }
        : null,
    );
  }, [
    children,
    id,
    isFullscreen,
    isLandscapeLayout,
    isRevealed,
    isStatusBarHidden,
    layerOpacity,
    onReady,
    revealOnLandscape,
  ]);

  useLayoutEffect(() => () => updateLayer(id, null), [id]);

  return (
    <TradingViewNativeChartActiveContext.Provider value={!isFullscreen}>
      {inline.current}
    </TradingViewNativeChartActiveContext.Provider>
  );
}

export function TradingViewNativeFullscreenPage() {
  return null;
}
