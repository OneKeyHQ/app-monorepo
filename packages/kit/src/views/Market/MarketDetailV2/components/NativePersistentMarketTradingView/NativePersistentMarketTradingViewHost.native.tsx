import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from 'react';

import {
  Dimensions,
  Animated as NativeAnimated,
  StyleSheet,
} from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';

import { AccountSelectorProviderMirror } from '@onekeyhq/kit/src/components/AccountSelector';
import { EJotaiContextStoreNames } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { EAccountSelectorSceneName } from '@onekeyhq/shared/types';

import { MarketWatchListProviderMirrorV2 } from '../../../MarketWatchListProviderMirrorV2';
import { hydrateMarketTradingViewPreferences } from '../../utils/marketTradingViewResolutionPreference';
import { getNativeMarketTradingViewPreloadPolicy } from '../../utils/nativeMarketTradingViewPreloadPolicy';
import { MarketTradingViewView } from '../MarketTradingView/MarketTradingView';

import {
  getNativeMarketTradingViewHostSnapshot,
  releaseNativeMarketTradingViewHostIfInactive,
  requestNativeMarketTradingViewWarmup,
  subscribeNativeMarketTradingViewHost,
} from './nativeMarketTradingViewHostStore';

import type { View } from 'react-native';

const GLOBAL_WARMUP_DEFER_MS = 3000;
const WARMUP_COMPACT_FALLBACK_MS = 12_000;
const CHART_CONTENT_FADE_DELAY_MS = 24;
const CHART_CONTENT_FADE_DURATION_MS = 180;
const WARMUP_SYMBOL = 'ONEKEY_PREWARM';
const ACCOUNT_SELECTOR_CONFIG = {
  sceneName: EAccountSelectorSceneName.home,
  sceneUrl: '',
};
const ACCOUNT_SELECTOR_ENABLED_NUM = [0];

const styles = StyleSheet.create({
  transitionLayer: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    zIndex: 10,
  },
  outer: {
    position: 'absolute',
    zIndex: 10,
    overflow: 'hidden',
  },
  inner: {
    position: 'absolute',
    left: 0,
  },
});

const warmupTradingViewProps = {
  tokenAddress: '',
  networkId: '',
  tokenSymbol: WARMUP_SYMBOL,
  decimal: 8,
  dataSource: 'polling',
  maxNativeSubIndicatorCount: 4,
} satisfies Parameters<typeof MarketTradingViewView>[0];

export function NativePersistentMarketTradingViewHost() {
  const preloadPolicy = useMemo(
    () => getNativeMarketTradingViewPreloadPolicy(),
    [],
  );
  const snapshot = useSyncExternalStore(
    subscribeNativeMarketTradingViewHost,
    getNativeMarketTradingViewHostSnapshot,
    getNativeMarketTradingViewHostSnapshot,
  );
  const [isWarmupCompact, setIsWarmupCompact] = useState(false);
  const [arePreferencesHydrated, setArePreferencesHydrated] = useState(false);
  const [hostWindowOrigin, setHostWindowOrigin] = useState<{
    x: number;
    y: number;
  }>();
  const hostRef = useRef<View>(null);
  const lastVisibleSessionIdRef = useRef<number | undefined>(undefined);
  const inactiveScrollY = useSharedValue(0);
  const chartVisibility = useSharedValue(0);
  const activeSession = snapshot.activeSession;
  const scrollY = activeSession?.scrollY ?? inactiveScrollY;
  const frame = activeSession?.frame;
  const isSessionActive = Boolean(activeSession);
  const isActive = Boolean(activeSession && frame && hostWindowOrigin);
  const activeSessionId = activeSession?.id;
  const transitionProgress = activeSession?.transitionProgress;
  const activeChartIdentity = activeSession
    ? `${activeSession.props.networkId}:${activeSession.props.tokenAddress}:${
        activeSession.props.tokenSymbol ?? ''
      }`
    : undefined;
  const windowSize = Dimensions.get('window');
  const measureHostWindowOrigin = useCallback(() => {
    hostRef.current?.measureInWindow((x, y) => {
      setHostWindowOrigin((currentOrigin) => {
        if (currentOrigin?.x === x && currentOrigin.y === y) {
          return currentOrigin;
        }
        return { x, y };
      });
    });
  }, []);
  const navigationTransitionStyle = useMemo(() => {
    if (!isActive || !transitionProgress) {
      return undefined;
    }
    return {
      transform: [
        {
          translateX: transitionProgress.interpolate({
            inputRange: [0, 1],
            outputRange: [windowSize.width, 0],
            extrapolate: 'clamp',
          }),
        },
      ],
    };
  }, [isActive, transitionProgress, windowSize.width]);

  useEffect(() => {
    let cancelled = false;
    void hydrateMarketTradingViewPreferences().then(() => {
      if (!cancelled) {
        setArePreferencesHydrated(true);
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!isActive) {
      chartVisibility.value = 0;
      return undefined;
    }

    const isSameVisibleSession =
      lastVisibleSessionIdRef.current === activeSessionId;
    lastVisibleSessionIdRef.current = activeSessionId;
    if (!isSameVisibleSession) {
      chartVisibility.value = 1;
      return undefined;
    }

    chartVisibility.value = 0;
    chartVisibility.value = withDelay(
      CHART_CONTENT_FADE_DELAY_MS,
      withTiming(1, {
        duration: CHART_CONTENT_FADE_DURATION_MS,
        easing: Easing.out(Easing.cubic),
      }),
    );
    return undefined;
  }, [activeChartIdentity, activeSessionId, chartVisibility, isActive]);

  useEffect(() => {
    if (!platformEnv.isNativeIOS || !preloadPolicy.enabled) {
      return undefined;
    }
    let cancelled = false;
    const preferenceHydrationPromise = hydrateMarketTradingViewPreferences();
    const timer = setTimeout(() => {
      void preferenceHydrationPromise.then(() => {
        if (!cancelled) {
          requestNativeMarketTradingViewWarmup();
        }
      });
    }, GLOBAL_WARMUP_DEFER_MS + preloadPolicy.delayMs);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [preloadPolicy]);

  useEffect(() => {
    if (!snapshot.mountRequested || activeSession) {
      setIsWarmupCompact(false);
      return undefined;
    }
    const timer = setTimeout(() => {
      setIsWarmupCompact(true);
    }, WARMUP_COMPACT_FALLBACK_MS);
    return () => clearTimeout(timer);
  }, [activeSession, snapshot.mountRequested]);

  useEffect(() => {
    const handleMemoryPressure = () => {
      releaseNativeMarketTradingViewHostIfInactive();
    };
    appEventBus.on(
      EAppEventBusNames.MemoryPressureWarning,
      handleMemoryPressure,
    );
    return () => {
      appEventBus.off(
        EAppEventBusNames.MemoryPressureWarning,
        handleMemoryPressure,
      );
    };
  }, []);

  const outerAnimatedStyle = useAnimatedStyle(() => {
    if (!isActive || !frame || !hostWindowOrigin) {
      return {
        left: isWarmupCompact ? -2 : -windowSize.width - 2,
        top: 0,
        width: isWarmupCompact ? 1 : windowSize.width,
        height: isWarmupCompact ? 1 : windowSize.height,
        opacity: 1,
      };
    }

    const rawTop = frame.anchorY - hostWindowOrigin.y - scrollY.value;
    const clippedTop = Math.max(rawTop, frame.clipTop);
    const clippedHeight = Math.max(
      0,
      frame.height - Math.max(0, clippedTop - rawTop),
    );
    return {
      left: frame.anchorX - hostWindowOrigin.x,
      top: clippedTop,
      width: frame.width,
      height: clippedHeight,
      opacity: clippedHeight > 0 ? chartVisibility.value : 0,
    };
  }, [
    frame,
    hostWindowOrigin,
    isActive,
    isWarmupCompact,
    windowSize.height,
    windowSize.width,
  ]);

  const innerAnimatedStyle = useAnimatedStyle(() => {
    if (!isActive || !frame || !hostWindowOrigin) {
      return {
        top: 0,
        width: isWarmupCompact ? 1 : windowSize.width,
        height: isWarmupCompact ? 1 : windowSize.height,
      };
    }

    const rawTop = frame.anchorY - hostWindowOrigin.y - scrollY.value;
    const clippedTop = Math.max(rawTop, frame.clipTop);
    return {
      top: rawTop - clippedTop,
      width: frame.width,
      height: frame.height,
    };
  }, [
    frame,
    hostWindowOrigin,
    isActive,
    isWarmupCompact,
    windowSize.height,
    windowSize.width,
  ]);

  if (
    !platformEnv.isNativeIOS ||
    !preloadPolicy.enabled ||
    !arePreferencesHydrated ||
    !snapshot.mountRequested
  ) {
    return null;
  }

  const tradingViewProps =
    activeSession?.props ?? snapshot.lastProps ?? warmupTradingViewProps;

  return (
    <AccountSelectorProviderMirror
      config={ACCOUNT_SELECTOR_CONFIG}
      enabledNum={ACCOUNT_SELECTOR_ENABLED_NUM}
    >
      <MarketWatchListProviderMirrorV2
        storeName={EJotaiContextStoreNames.marketWatchListV2}
      >
        <NativeAnimated.View
          ref={hostRef}
          pointerEvents="box-none"
          style={[styles.transitionLayer, navigationTransitionStyle]}
          onLayout={measureHostWindowOrigin}
        >
          <Animated.View
            pointerEvents={isActive ? 'auto' : 'none'}
            style={[styles.outer, outerAnimatedStyle]}
          >
            <Animated.View style={[styles.inner, innerAnimatedStyle]}>
              <MarketTradingViewView
                {...tradingViewProps}
                isActive={isSessionActive}
                isVisibilityManagedExternally
              />
            </Animated.View>
          </Animated.View>
        </NativeAnimated.View>
      </MarketWatchListProviderMirrorV2>
    </AccountSelectorProviderMirror>
  );
}
