import { useCallback } from 'react';

import {
  Easing,
  runOnUI,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { useSafeAreaInsets } from '@onekeyhq/components';
import type { IWebViewOnScrollEvent } from '@onekeyhq/kit/src/components/WebView/types';

import {
  getCollapsedPillBottom,
  isCompactBrowserChrome,
} from '../components/MobileBrowser/browserChrome';
import {
  BROWSER_BOTTOM_BAR_HEIGHT,
  BROWSER_COLLAPSED_PILL_HEIGHT,
  DISPLAY_BOTTOM_BAR_DURATION,
  MIN_TOGGLE_BROWSER_VISIBLE_DISTANCE,
} from '../config/Animation.constants';

// Sentinel for "undefined" in SharedValue (SharedValue<number> can't hold undefined)
const UNSET = -1;

const EXPANDED = 1;
const COLLAPSED = 0;
// Like Safari, the chrome comes back near the top and at the end of a page.
const EDGE_EXPAND_DISTANCE = 24;

const timingConfig = {
  duration: DISPLAY_BOTTOM_BAR_DURATION,
  easing: Easing.inOut(Easing.quad),
};

// The compact iOS bar floats over the page (Liquid Glass shows the content
// through it), so the WebView keeps its full height; scrollable content is
// kept reachable above the bar via the WebView contentInset instead.
const compactWebPageStyle = { bottom: 0 };

// Drives the mobile browser chrome (header + bottom bar) from WebView scroll:
// scrolling down collapses both; scrolling up, reaching an edge of the page,
// or a non-scrollable page brings them back.
function useMobileBrowserChromeAnimation() {
  const { bottom: bottomInset } = useSafeAreaInsets();
  const fullBarHeight = BROWSER_BOTTOM_BAR_HEIGHT + bottomInset;
  // 1 = chrome fully expanded, 0 = collapsed.
  const chromeProgress = useSharedValue(EXPANDED);
  const lastScrollY = useSharedValue(UNSET);
  const lastTurnScrollY = useSharedValue(UNSET);
  // Room the collapsed pill needs when the bar is laid out in-flow (iPad).
  const collapsedBarHeight = isCompactBrowserChrome
    ? getCollapsedPillBottom(bottomInset) + BROWSER_COLLAPSED_PILL_HEIGHT + 4
    : 0;

  // Direction detection + SharedValue writes run entirely on UI thread.
  // WebView onScroll is JS-thread only, so we extract numeric values in JS
  // and dispatch via runOnUI to avoid an extra JS→UI hop for withTiming.
  const processScroll = useCallback(
    (
      contentOffsetY: number,
      maxOffsetY: number,
      canScroll: boolean,
      isOutOfBounds: boolean,
    ) => {
      'worklet';

      if (isOutOfBounds) {
        lastScrollY.value = UNSET;
        lastTurnScrollY.value = UNSET;
        return;
      }

      if (
        !canScroll ||
        contentOffsetY <= EDGE_EXPAND_DISTANCE ||
        contentOffsetY >= maxOffsetY - EDGE_EXPAND_DISTANCE
      ) {
        if (chromeProgress.value !== EXPANDED) {
          chromeProgress.value = withTiming(EXPANDED, timingConfig);
        }
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
      const target = distanceOffsetY < 0 ? EXPANDED : COLLAPSED;
      if (chromeProgress.value !== target) {
        chromeProgress.value = withTiming(target, timingConfig);
      }
    },
    [chromeProgress, lastScrollY, lastTurnScrollY],
  );

  const handleScroll = useCallback(
    ({ nativeEvent }: IWebViewOnScrollEvent) => {
      const { contentOffset, contentSize, contentInset, layoutMeasurement } =
        nativeEvent;
      const contentOffsetY = contentOffset.y;
      // contentInset extends the scroll range (the iOS bar inset adds room
      // at the bottom), so the bounce zone starts past it.
      const maxOffsetY =
        contentSize.height + contentInset.bottom - layoutMeasurement.height;
      const isOutOfBounds =
        contentOffsetY < -contentInset.top ||
        Math.round(contentOffsetY) > Math.round(maxOffsetY);
      const canScroll =
        Math.round(contentSize.height) >
        Math.round(layoutMeasurement.height) +
          MIN_TOGGLE_BROWSER_VISIBLE_DISTANCE;

      runOnUI(processScroll)(
        contentOffsetY,
        maxOffsetY,
        canScroll,
        isOutOfBounds,
      );
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

  // Bar container. Android (and the in-flow iPad layout) shrinks it with the
  // chrome; the compact iOS bar fades its own content and only keeps room for
  // the collapsed pill.
  const toolbarAnimatedStyle = useAnimatedStyle(() => {
    const height = Math.max(
      collapsedBarHeight,
      fullBarHeight * chromeProgress.value,
    );
    return isCompactBrowserChrome
      ? { height }
      : { height, opacity: chromeProgress.value };
  });
  // Phone layout overlays the bar on the WebView layer. The compact iOS bar
  // keeps a fixed box (touches pass through via box-none) so the collapsed
  // pill can float over the page.
  const toolbarOverlayStyle = isCompactBrowserChrome
    ? { height: fullBarHeight }
    : toolbarAnimatedStyle;
  const animatedWebPageStyle = useAnimatedStyle(() => ({
    bottom: fullBarHeight * chromeProgress.value,
  }));
  const webPageAnimatedStyle = isCompactBrowserChrome
    ? compactWebPageStyle
    : animatedWebPageStyle;

  return {
    handleScroll,
    expandBrowserChrome,
    chromeProgress,
    toolbarAnimatedStyle,
    toolbarOverlayStyle,
    webPageAnimatedStyle,
    fullBarHeight,
  };
}

export default useMobileBrowserChromeAnimation;
