import { useCallback, useEffect, useState } from 'react';

import {
  Easing,
  runOnJS,
  runOnUI,
  useAnimatedReaction,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { useSafeAreaInsets } from '@onekeyhq/components';
import type { IWebViewOnScrollEvent } from '@onekeyhq/kit/src/components/WebView/types';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import {
  BROWSER_BOTTOM_BAR_HEIGHT,
  BROWSER_COLLAPSED_PILL_HEIGHT,
  BROWSER_HEADER_CROSSFADE_POINT,
  DISPLAY_BOTTOM_BAR_DURATION,
  MIN_TOGGLE_BROWSER_VISIBLE_DISTANCE,
} from '../config/Animation.constants';

// Sentinel for "undefined" in SharedValue (SharedValue<number> can't hold undefined)
const UNSET = -1;

const EXPANDED = 1;
const COLLAPSED = 0;

const timingConfig = {
  duration: DISPLAY_BOTTOM_BAR_DURATION,
  easing: Easing.inOut(Easing.quad),
};

// iOS uses the Safari-style chrome: glass capsules in the bottom bar and a
// compact address pill that stays visible while the chrome is collapsed.
export const isCompactBrowserChrome = platformEnv.isNativeIOS;

// Sits just above the home indicator, overlapping the bottom safe area.
export function getCollapsedPillBottom(bottomInset: number) {
  return Math.max(bottomInset - 20, 8);
}

// Drives the mobile browser chrome (header + bottom bar) from WebView scroll:
// scrolling down hides the bottom bar and collapses the header into a compact
// domain strip; scrolling up (or a non-scrollable page) brings both back.
function useMobileBottomBarAnimation(activeTabId: string | null) {
  const { bottom: bottomInset } = useSafeAreaInsets();
  const fullBarHeight = BROWSER_BOTTOM_BAR_HEIGHT + bottomInset;
  // 1 = chrome fully expanded, 0 = bottom bar hidden + header collapsed.
  const chromeProgress = useSharedValue(EXPANDED);
  const lastScrollY = useSharedValue(UNSET);
  const lastTurnScrollY = useSharedValue(UNSET);
  const [isChromeCollapsed, setIsChromeCollapsed] = useState(false);
  // Room the collapsed pill needs when the bar is laid out in-flow (iPad).
  const collapsedBarHeight = isCompactBrowserChrome
    ? getCollapsedPillBottom(bottomInset) + BROWSER_COLLAPSED_PILL_HEIGHT + 4
    : 0;

  // Direction detection + SharedValue writes run entirely on UI thread.
  // WebView onScroll is JS-thread only, so we extract numeric values in JS
  // and dispatch via runOnUI to avoid an extra JS→UI hop for withTiming.
  const processScroll = useCallback(
    (contentOffsetY: number, canScroll: boolean, isOutOfBounds: boolean) => {
      'worklet';

      if (isOutOfBounds) {
        lastScrollY.value = UNSET;
        lastTurnScrollY.value = UNSET;
        return;
      }

      if (!canScroll) {
        chromeProgress.value = withTiming(EXPANDED, timingConfig);
        return;
      }

      if (
        lastScrollY.value === UNSET ||
        lastTurnScrollY.value === UNSET ||
        (contentOffsetY - lastScrollY.value) *
          (lastScrollY.value - lastTurnScrollY.value) <
          0
      ) {
        lastTurnScrollY.value = lastScrollY.value;
      }
      lastScrollY.value = contentOffsetY;
      if (lastTurnScrollY.value === UNSET) {
        return;
      }
      const distanceOffsetY = contentOffsetY - lastTurnScrollY.value;
      if (Math.abs(distanceOffsetY) <= MIN_TOGGLE_BROWSER_VISIBLE_DISTANCE) {
        return;
      }
      chromeProgress.value = withTiming(
        distanceOffsetY < 0 ? EXPANDED : COLLAPSED,
        timingConfig,
      );
    },
    [chromeProgress, lastScrollY, lastTurnScrollY],
  );

  const handleScroll = useCallback(
    ({ nativeEvent }: IWebViewOnScrollEvent) => {
      const { contentOffset, contentSize, contentInset, layoutMeasurement } =
        nativeEvent;
      const contentOffsetY = contentOffset.y;
      const scrollableHeight =
        contentSize.height -
        (layoutMeasurement.height + contentInset.top + contentInset.bottom);
      const isOutOfBounds =
        contentOffsetY < 0 ||
        Math.round(contentOffsetY) > Math.round(scrollableHeight);
      const canScroll =
        Math.round(contentSize.height) >
        Math.round(layoutMeasurement.height) +
          MIN_TOGGLE_BROWSER_VISIBLE_DISTANCE;

      runOnUI(processScroll)(contentOffsetY, canScroll, isOutOfBounds);
    },
    [processScroll],
  );

  const expandBrowserChrome = useCallback(() => {
    chromeProgress.value = withTiming(EXPANDED, timingConfig);
    runOnUI(() => {
      'worklet';

      lastScrollY.value = UNSET;
      lastTurnScrollY.value = UNSET;
    })();
  }, [chromeProgress, lastScrollY, lastTurnScrollY]);

  // Only flip JS state when crossing the crossfade point, so touch targets
  // follow the visible header layer without re-rendering on every frame.
  useAnimatedReaction(
    () => chromeProgress.value < BROWSER_HEADER_CROSSFADE_POINT,
    (collapsed, previous) => {
      if (collapsed !== previous) {
        runOnJS(setIsChromeCollapsed)(collapsed);
      }
    },
  );

  // In-flow bar container (tablet layout). The compact iOS bar fades its own
  // content and keeps room for the collapsed pill.
  const toolbarAnimatedStyle = useAnimatedStyle(() => {
    const height = Math.max(
      collapsedBarHeight,
      fullBarHeight * chromeProgress.value,
    );
    return isCompactBrowserChrome
      ? { height }
      : { height, opacity: chromeProgress.value };
  });
  // Bar container overlaid on the WebView layer (phone layout). The compact
  // iOS bar keeps a fixed box (touches pass through via box-none) so the
  // collapsed pill can float over the page.
  const toolbarOverlayStyle = useAnimatedStyle(() =>
    isCompactBrowserChrome
      ? { height: fullBarHeight }
      : {
          height: fullBarHeight * chromeProgress.value,
          opacity: chromeProgress.value,
        },
  );
  const webPageAnimatedStyle = useAnimatedStyle(() => ({
    bottom: fullBarHeight * chromeProgress.value,
  }));

  // Reset toolbar animation state when activeTabId changes.
  useEffect(() => {
    expandBrowserChrome();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTabId, fullBarHeight]);

  return {
    handleScroll,
    expandBrowserChrome,
    isChromeCollapsed,
    toolbarAnimatedStyle,
    toolbarOverlayStyle,
    webPageAnimatedStyle,
    chromeProgress,
  };
}

export default useMobileBottomBarAnimation;
