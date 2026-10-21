import {
  useCallback,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from 'react';
import type { ReactNode } from 'react';

import {
  CommonActions,
  StackActions,
  useNavigation,
  useRoute,
} from '@react-navigation/native';
import { useWindowDimensions } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';

import { Stack, rootNavigationRef } from '@onekeyhq/components';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { ERootRoutes } from '@onekeyhq/shared/src/routes';

import { TradingViewNativeChartActiveContext } from './TradingViewNativeChartActiveContext';
import { TradingViewNativeChartReadyContext } from './TradingViewNativeChartReadyContext';

import type {
  IPushTradingViewNativeFullscreenModal,
  ITradingViewNativePresentationProps,
} from './TradingViewNativePresentation';
import type { RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { LayoutChangeEvent } from 'react-native';

type IFullscreenParamList = {
  [ERootRoutes.TradingViewNativeFullscreen]: { presentationId: string };
};

type IFullscreenEntry = {
  content: ReactNode;
  onClose?: () => void;
  closing?: boolean;
};
const entries = new Map<string, IFullscreenEntry>();
const listeners = new Set<() => void>();

export const pushTradingViewNativeFullscreenModal: IPushTradingViewNativeFullscreenModal =
  (route, params) => {
    const navigation = rootNavigationRef.current;
    const state = navigation?.getState();
    const currentRoute = state?.routes[state.index];
    if (
      !navigation ||
      currentRoute?.name !== ERootRoutes.TradingViewNativeFullscreen
    ) {
      return false;
    }
    // Keep the chart mounted so dismissing settings returns to fullscreen.
    navigation.dispatch({
      ...StackActions.push(ERootRoutes.Modal, {
        screen: route,
        params,
        tradingViewFullscreen: true,
      }),
      source: currentRoute.key,
      target: state?.key,
    });
    return true;
  };

function publish(id: string, entry?: IFullscreenEntry) {
  if (entry) entries.set(id, entry);
  else entries.delete(id);
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function closePage(id: string) {
  const navigation = rootNavigationRef.current;
  const state = navigation?.getState();
  const route = state?.routes.find(
    (candidate) =>
      candidate.name === ERootRoutes.TradingViewNativeFullscreen &&
      (candidate.params as { presentationId?: string } | undefined)
        ?.presentationId === id,
  );
  if (navigation && route) {
    navigation.dispatch({
      ...CommonActions.goBack(),
      source: route.key,
      target: state?.key,
    });
  }
}

export function TradingViewNativeFullscreenPage() {
  const navigation =
    useNavigation<NativeStackNavigationProp<IFullscreenParamList>>();
  const {
    params: { presentationId },
  } =
    useRoute<
      RouteProp<IFullscreenParamList, ERootRoutes.TradingViewNativeFullscreen>
    >();
  const entry = useSyncExternalStore(subscribe, () =>
    entries.get(presentationId),
  );
  const onCloseRef = useRef(entry?.onClose);
  const { width, height } = useWindowDimensions();
  const layoutRef = useRef({ width: 0, height: 0 });
  const closingRef = useRef(entry?.closing);
  const revealedRef = useRef(false);
  closingRef.current = entry?.closing;
  const [hasExpectedLayout, setHasExpectedLayout] = useState(false);
  const handleLayout = useCallback(
    ({ nativeEvent: { layout } }: LayoutChangeEvent) => {
      layoutRef.current = layout;
      if (closingRef.current && layout.height >= layout.width) {
        closePage(presentationId);
      } else {
        setHasExpectedLayout(
          platformEnv.isNativeIOSPad || layout.width > layout.height,
        );
      }
    },
    [presentationId],
  );
  const handleChartReady = useCallback(() => {
    if (closingRef.current || revealedRef.current) return;
    revealedRef.current = true;
    navigation.setOptions({ contentReady: true });
  }, [navigation]);
  useLayoutEffect(() => {
    if (!entry?.closing) return;
    if (
      platformEnv.isNativeIOSPad ||
      layoutRef.current.height >= layoutRef.current.width
    ) {
      closePage(presentationId);
      return;
    }
    // Freeze the complete native frame while UIKit restores the detail's bounds.
    navigation.setOptions({ contentReady: false, orientation: 'portrait' });
  }, [entry?.closing, navigation, presentationId]);
  useLayoutEffect(() => {
    if (!entry) closePage(presentationId);
  }, [entry, presentationId]);
  useLayoutEffect(() => {
    onCloseRef.current = entry?.onClose;
  }, [entry?.onClose]);
  useLayoutEffect(
    () => () => {
      closingRef.current = true;
      publish(presentationId);
      onCloseRef.current?.();
    },
    [presentationId],
  );
  return (
    <Stack
      flex={1}
      bg="$bgApp"
      onLayout={handleLayout}
      testID="trading-view-native-fullscreen-layer"
    >
      <GestureHandlerRootView
        style={
          platformEnv.isNativeIOSPad
            ? { flex: 1 }
            : {
                width: Math.max(width, height),
                height: Math.min(width, height),
              }
        }
      >
        <SafeAreaProvider style={{ flex: 1 }}>
          <SafeAreaView style={{ flex: 1 }}>
            <TradingViewNativeChartActiveContext.Provider value>
              <TradingViewNativeChartReadyContext.Provider
                value={hasExpectedLayout ? handleChartReady : undefined}
              >
                {entry?.content}
              </TradingViewNativeChartReadyContext.Provider>
            </TradingViewNativeChartActiveContext.Provider>
          </SafeAreaView>
        </SafeAreaProvider>
      </GestureHandlerRootView>
    </Stack>
  );
}

export function TradingViewNativePresentation({
  children,
  isFullscreen,
  onRequestClose,
}: ITradingViewNativePresentationProps) {
  const id = useId();
  const sequence = useRef(0);
  const opened = useRef<string | undefined>(undefined);
  const inline = useRef(children);
  if (!isFullscreen) inline.current = children;
  useLayoutEffect(() => {
    if (isFullscreen) {
      const navigation = rootNavigationRef.current;
      if (!navigation) {
        onRequestClose?.();
        return;
      }
      const isOpening =
        !opened.current || entries.get(opened.current)?.closing === true;
      if (isOpening) sequence.current += 1;
      const presentationId = isOpening
        ? `${id}-${sequence.current}`
        : (opened.current ?? `${id}-${sequence.current}`);
      opened.current = presentationId;
      publish(presentationId, {
        content: children,
        onClose: () => {
          // A departing page must not close a newer fullscreen session.
          if (opened.current === presentationId) {
            opened.current = undefined;
            onRequestClose?.();
          }
        },
      });
      if (isOpening) {
        navigation.dispatch(
          StackActions.push(ERootRoutes.TradingViewNativeFullscreen, {
            presentationId,
          }),
        );
      }
    } else if (opened.current) {
      const closing = opened.current;
      const entry = entries.get(closing);
      if (entry && !entry.closing) {
        publish(closing, { ...entry, closing: true });
      }
    }
  }, [children, id, isFullscreen, onRequestClose]);
  useLayoutEffect(
    () => () => {
      const closing = opened.current;
      opened.current = undefined;
      if (closing) {
        closePage(closing);
        publish(closing);
      }
    },
    [],
  );
  // UIKit covers the unchanged inline chart when its fullscreen page is ready.
  return (
    <TradingViewNativeChartActiveContext.Provider value={!isFullscreen}>
      {inline.current}
    </TradingViewNativeChartActiveContext.Provider>
  );
}

export function TradingViewNativeFullscreenHost() {
  return null;
}
