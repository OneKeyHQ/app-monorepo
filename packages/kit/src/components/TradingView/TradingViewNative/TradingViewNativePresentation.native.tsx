import { memo, useId, useLayoutEffect, useSyncExternalStore } from 'react';
import type { ReactNode } from 'react';

import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';

import { Stack } from '@onekeyhq/components';

import type { ITradingViewNativePresentationProps } from './TradingViewNativePresentation';

const FullscreenChart = memo(
  ({ children }: Pick<ITradingViewNativePresentationProps, 'children'>) => (
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
      <GestureHandlerRootView style={{ flex: 1 }}>
        <SafeAreaProvider style={{ flex: 1 }}>
          <SafeAreaView style={{ flex: 1 }}>{children}</SafeAreaView>
        </SafeAreaProvider>
      </GestureHandlerRootView>
    </Stack>
  ),
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

export function TradingViewNativeFullscreenHost() {
  // Root-siblings defers every mutation with a timer. Rotation needs this
  // window layer to mount and unmount in the chart owner's layout commit.
  const activeLayers = useSyncExternalStore(
    subscribe,
    getSnapshot,
    getSnapshot,
  );
  return activeLayers.map(({ id, content }) => (
    <FullscreenChart key={id}>{content}</FullscreenChart>
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
