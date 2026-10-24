import { useCallback, useMemo, useRef } from 'react';

import {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { useSafeAreaInsets } from '@onekeyhq/components';
import type { IWebViewOnScrollEvent } from '@onekeyhq/kit/src/components/WebView/types';

import {
  getBarReservedHeight,
  getCollapsedReservedHeight,
} from '../components/MobileBrowser/browserChrome';
import {
  DISPLAY_BOTTOM_BAR_DURATION,
  MIN_TOGGLE_BROWSER_VISIBLE_DISTANCE,
} from '../config/Animation.constants';

const EXPANDED = 1;
const COLLAPSED = 0;
// Like Safari, the chrome comes back near the top and at the end of a page.
const EDGE_EXPAND_DISTANCE = 24;

// Emphasized ease-out: starts quickly and settles softly, so the bar/pill
// morph reads as one fluid motion rather than a snap.
const timingConfig = {
  duration: DISPLAY_BOTTOM_BAR_DURATION,
  easing: Easing.bezier(0.2, 0, 0, 1),
};

// Drives the mobile browser chrome (header + bottom bar) from WebView scroll:
// scrolling down collapses both; scrolling up, reaching an edge of the page,
// or a non-scrollable page brings them back.
function useMobileBrowserChromeAnimation() {
  const { bottom: bottomInset } = useSafeAreaInsets();
  const fullBarHeight = getBarReservedHeight(bottomInset);
  // 1 = chrome fully expanded, 0 = collapsed.
  const chromeProgress = useSharedValue(EXPANDED);
  // Scroll direction tracking stays on the JS thread, where WebView scroll
  // events arrive (one per frame): the UI thread is only touched when the
  // chrome actually has to animate, about twice per gesture, instead of a
  // runOnUI hop for every event.
  const lastScrollYRef = useRef<number | undefined>(undefined);
  const lastTurnScrollYRef = useRef<number | undefined>(undefined);
  const targetRef = useRef(EXPANDED);
  // Room the collapsed pill needs when the bar is laid out in-flow (tablets).
  const collapsedBarHeight = getCollapsedReservedHeight(bottomInset);

  const animateTo = useCallback(
    (target: number) => {
      if (targetRef.current === target) {
        return;
      }
      targetRef.current = target;
      chromeProgress.value = withTiming(target, timingConfig);
    },
    [chromeProgress],
  );

  const handleScroll = useCallback(
    ({ nativeEvent }: IWebViewOnScrollEvent) => {
      const { contentOffset, contentSize, contentInset, layoutMeasurement } =
        nativeEvent;
      const contentOffsetY = contentOffset.y;
      // contentInset extends the scroll range, so the bounce zone starts
      // past it.
      const maxOffsetY =
        contentSize.height + contentInset.bottom - layoutMeasurement.height;
      const isOutOfBounds =
        contentOffsetY < -contentInset.top ||
        Math.round(contentOffsetY) > Math.round(maxOffsetY);
      const canScroll =
        Math.round(contentSize.height) >
        Math.round(layoutMeasurement.height) +
          MIN_TOGGLE_BROWSER_VISIBLE_DISTANCE;

      if (isOutOfBounds) {
        lastScrollYRef.current = undefined;
        lastTurnScrollYRef.current = undefined;
        return;
      }
      if (
        !canScroll ||
        contentOffsetY <= EDGE_EXPAND_DISTANCE ||
        contentOffsetY >= maxOffsetY - EDGE_EXPAND_DISTANCE
      ) {
        // Restart direction tracking from here: expanding shrinks the WebView
        // and moves the bottom edge, and a stale turn point from before would
        // read the next event as a long scroll down and collapse again.
        lastScrollYRef.current = contentOffsetY;
        lastTurnScrollYRef.current = contentOffsetY;
        animateTo(EXPANDED);
        return;
      }

      const lastY = lastScrollYRef.current;
      const turnY = lastTurnScrollYRef.current;
      if (
        lastY === undefined ||
        turnY === undefined ||
        (contentOffsetY - lastY) * (lastY - turnY) < 0
      ) {
        lastTurnScrollYRef.current = lastY;
      }
      lastScrollYRef.current = contentOffsetY;
      const turn = lastTurnScrollYRef.current;
      if (turn === undefined) {
        return;
      }
      const distanceOffsetY = contentOffsetY - turn;
      if (Math.abs(distanceOffsetY) <= MIN_TOGGLE_BROWSER_VISIBLE_DISTANCE) {
        return;
      }
      animateTo(distanceOffsetY < 0 ? EXPANDED : COLLAPSED);
    },
    [animateTo],
  );

  const expandBrowserChrome = useCallback(() => {
    lastScrollYRef.current = undefined;
    lastTurnScrollYRef.current = undefined;
    animateTo(EXPANDED);
  }, [animateTo]);

  // In-flow bar container (tablet layout): shrinks with the chrome but keeps
  // room for the collapsed pill. The bar fades its own content.
  const toolbarAnimatedStyle = useAnimatedStyle(() => ({
    height: Math.max(collapsedBarHeight, fullBarHeight * chromeProgress.value),
  }));
  // Phone layout overlays the bar on the WebView layer in a fixed box
  // (touches pass through via box-none); the WebView itself ends above it.
  const toolbarOverlayStyle = useMemo(
    () => ({ height: fullBarHeight }),
    [fullBarHeight],
  );
  // The WebView ends above the bar, and above the collapsed pill's strip
  // once collapsed, so the chrome never covers page content.
  const webPageAnimatedStyle = useAnimatedStyle(() => ({
    bottom:
      collapsedBarHeight +
      (fullBarHeight - collapsedBarHeight) * chromeProgress.value,
  }));

  return {
    handleScroll,
    expandBrowserChrome,
    chromeProgress,
    toolbarAnimatedStyle,
    toolbarOverlayStyle,
    webPageAnimatedStyle,
  };
}

export default useMobileBrowserChromeAnimation;
