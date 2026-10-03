import { memo, useId, useLayoutEffect, useSyncExternalStore } from 'react';
import type { ReactNode } from 'react';

import { OverlayView } from '@onekeyfe/react-native-native-overlay';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Stack } from '@onekeyhq/components';

import type { ITradingViewNativePresentationProps } from './TradingViewNativePresentation';

// The host sits inside the app's providers, so their safe-area insets apply;
// a nested SafeAreaProvider would render nothing until its own native view
// reports insets from inside the overlay window.
const FullscreenChart = memo(
  ({ children }: Pick<ITradingViewNativePresentationProps, 'children'>) => {
    const insets = useSafeAreaInsets();
    return (
      <Stack
        position="absolute"
        top={0}
        right={0}
        bottom={0}
        left={0}
        bg="$bgApp"
        collapsable={false}
        accessibilityViewIsModal
        testID="trading-view-native-fullscreen-layer"
      >
        <GestureHandlerRootView
          style={{
            flex: 1,
            paddingTop: insets.top,
            paddingRight: insets.right,
            paddingBottom: insets.bottom,
            paddingLeft: insets.left,
          }}
        >
          {children}
        </GestureHandlerRootView>
      </Stack>
    );
  },
);
FullscreenChart.displayName = 'FullscreenChart';

const layers = new Map<string, ReactNode>();
const listeners = new Set<() => void>();
let snapshot: { id: string; content: ReactNode }[] = [];

function updateLayer(id: string, content: ReactNode) {
  if (content === null) {
    if (!layers.delete(id)) {
      return;
    }
  } else {
    if (layers.get(id) === content) {
      return;
    }
    layers.set(id, content);
  }
  snapshot = Array.from(layers, ([layerId, layerContent]) => ({
    id: layerId,
    content: layerContent,
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

// The chart owner's page freezes while its chart is fullscreen, so the chart
// cannot present from inside it: the owner hands its content to this host
// (mounted with the app's overlays), which presents it in a native `modal`
// overlay. `useSyncExternalStore` keeps the hand-off in the owner's layout
// commit, which rotation relies on. Non-blocking and not dismissed by back:
// back keeps reaching the page, and the chart's own control exits.
export function TradingViewNativeFullscreenHost() {
  const activeLayers = useSyncExternalStore(
    subscribe,
    getSnapshot,
    getSnapshot,
  );
  return activeLayers.map(({ id, content }) => (
    <OverlayView
      key={id}
      visible
      level="modal"
      presentation="fullscreen"
      animation={FULLSCREEN_HOST_ANIMATION}
      blocking={false}
      backdrop={false}
      dismissOnBackPress={false}
    >
      <FullscreenChart>{content}</FullscreenChart>
    </OverlayView>
  ));
}

export function TradingViewNativePresentation({
  children,
  isFullscreen,
}: ITradingViewNativePresentationProps) {
  const id = useId();

  useLayoutEffect(() => {
    updateLayer(id, isFullscreen ? children : null);
  }, [children, id, isFullscreen]);

  useLayoutEffect(() => () => updateLayer(id, null), [id]);

  return isFullscreen ? null : children;
}
