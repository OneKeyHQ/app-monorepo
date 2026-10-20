import {
  memo,
  useId,
  useLayoutEffect,
  useMemo,
  useSyncExternalStore,
} from 'react';
import type { ReactNode } from 'react';

import { Image, StyleSheet, useWindowDimensions } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import {
  SafeAreaInsetsContext,
  SafeAreaProvider,
  SafeAreaView,
  useSafeAreaInsets,
} from 'react-native-safe-area-context';

import { OverlayContainer, Stack } from '@onekeyhq/components';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { TradingViewNativePresentationRotationContext } from './native/TradingViewNativePresentationContext';

import type { ITradingViewNativePresentationProps } from './TradingViewNativePresentation';

const FullscreenChart = memo(
  ({ children }: Pick<ITradingViewNativePresentationProps, 'children'>) => {
    const { width, height } = useWindowDimensions();
    const insets = useSafeAreaInsets();
    const rotateChart =
      platformEnv.isNativeIOS && !platformEnv.isNativeIOSPad && height > width;
    const chartInsets = useMemo(
      () => ({
        top: insets.right,
        bottom: insets.left,
        left: insets.top,
        right: insets.bottom,
      }),
      [insets.bottom, insets.left, insets.right, insets.top],
    );
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
        {rotateChart ? (
          <Stack
            position="absolute"
            width={height}
            height={width}
            left={(width - height) / 2}
            top={(height - width) / 2}
            rotate="90deg"
          >
            <GestureHandlerRootView style={{ flex: 1 }}>
              <SafeAreaInsetsContext.Provider value={chartInsets}>
                <Stack
                  flex={1}
                  paddingTop={chartInsets.top}
                  paddingBottom={chartInsets.bottom}
                  paddingLeft={chartInsets.left}
                  paddingRight={chartInsets.right}
                >
                  <TradingViewNativePresentationRotationContext.Provider value>
                    {children}
                  </TradingViewNativePresentationRotationContext.Provider>
                </Stack>
              </SafeAreaInsetsContext.Provider>
            </GestureHandlerRootView>
          </Stack>
        ) : (
          <GestureHandlerRootView style={{ flex: 1 }}>
            <SafeAreaProvider style={{ flex: 1 }}>
              <SafeAreaView style={{ flex: 1 }}>{children}</SafeAreaView>
            </SafeAreaProvider>
          </GestureHandlerRootView>
        )}
      </Stack>
    );
  },
);
FullscreenChart.displayName = 'FullscreenChart';

const layers = new Map<string, ReactNode>();
const covers = new Map<string, IFullscreenTransitionCover>();
const listeners = new Set<() => void>();
let snapshot = {
  layers: [] as { id: string; content: ReactNode }[],
  covers: [] as { id: string; cover: IFullscreenTransitionCover }[],
};

interface IFullscreenTransitionCover {
  uri: string;
  onLoad: () => void;
  onError: () => void;
}

function publishSnapshot() {
  snapshot = {
    layers: Array.from(layers, ([id, content]) => ({ id, content })),
    covers: Array.from(covers, ([id, cover]) => ({ id, cover })),
  };
  listeners.forEach((listener) => listener());
}

export function setTradingViewNativeTransitionCover(
  id: string,
  cover: IFullscreenTransitionCover | null,
) {
  if (cover) {
    covers.set(id, cover);
  } else if (!covers.delete(id)) {
    return;
  }
  publishSnapshot();
}

function FullscreenTransitionCover({
  cover,
}: {
  cover: IFullscreenTransitionCover;
}) {
  return (
    // FullWindowOverlay appends native children regardless of their React order.
    // Own a window container so a newly mounted chart cannot cover this image.
    <OverlayContainer>
      <Stack
        position="absolute"
        top={0}
        right={0}
        bottom={0}
        left={0}
        collapsable={false}
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        testID="trading-view-native-transition-cover"
      >
        <Image
          source={{ uri: cover.uri }}
          onLoad={cover.onLoad}
          onError={cover.onError}
          resizeMode="stretch"
          style={StyleSheet.absoluteFill}
        />
      </Stack>
    </OverlayContainer>
  );
}

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
  publishSnapshot();
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
  return (
    <>
      {activeLayers.layers.map(({ id, content }) => (
        <FullscreenChart key={id}>{content}</FullscreenChart>
      ))}
      {activeLayers.covers.map(({ id, cover }) => (
        <FullscreenTransitionCover key={id} cover={cover} />
      ))}
    </>
  );
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
