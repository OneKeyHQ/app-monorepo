import { useCallback, useMemo, useRef } from 'react';

import {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';

import { useSafeAreaInsets } from '@onekeyhq/components';
import type { IWebViewOnScrollEvent } from '@onekeyhq/kit/src/components/WebView/types';

import {
  getBarReservedHeight,
  getCollapsedReservedHeight,
} from '../components/MobileBrowser/browserChrome';
import {
  BROWSER_HEADER_HEIGHT,
  DISPLAY_BOTTOM_BAR_DURATION,
  MIN_TOGGLE_BROWSER_VISIBLE_DISTANCE,
} from '../config/Animation.constants';

const EXPANDED = 1;
const COLLAPSED = 0;
// Like Safari, the chrome comes back near the top and at the end of a page.
const EDGE_EXPAND_DISTANCE = 24;

// A critically damped spring, like UIKit's default system animations: eases
// in and out evenly with no overshoot (progress stays within 0..1), instead of
// a curve that does most of the move in its first frames. When the scroll
// direction flips mid-morph it carries the current velocity into the reverse
// move rather than restarting from rest.
const springConfig = {
  duration: DISPLAY_BOTTOM_BAR_DURATION,
  dampingRatio: 1,
  overshootClamping: true,
};

// Drives the mobile browser chrome (header + bottom bar) from WebView scroll:
// scrolling down collapses both; scrolling up, reaching an edge of the page,
// or a non-scrollable page brings them back.
function useMobileBrowserChromeAnimation() {
  const { bottom: bottomInset } = useSafeAreaInsets();
  const fullBarHeight = getBarReservedHeight(bottomInset);
  // 1 = chrome fully expanded, 0 = collapsed.
  const chromeProgress = useSharedValue(EXPANDED);
  // The size the WebView is laid out for: 1 (room for the expanded chrome)
  // only once the chrome is fully expanded, else 0 (the larger, collapsed
  // size). The WebView keeps that size through the animation and only moves;
  // resizing it every frame made WebKit re-lay-out the page each frame
  // (dropped frames on heavy dApps). Like Chrome's toolbar it grows when a
  // collapse starts and shrinks when an expand ends, so the edge that changes
  // is always under the bar and never shows as a gap or a jump.
  const layoutExpanded = useSharedValue(EXPANDED);
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
      if (target === COLLAPSED) {
        layoutExpanded.value = COLLAPSED;
      }
      chromeProgress.value = withSpring(target, springConfig, (finished) => {
        'worklet';

        if (finished && target === EXPANDED) {
          layoutExpanded.value = EXPANDED;
        }
      });
    },
    [chromeProgress, layoutExpanded],
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
  // room for the collapsed pill. The bar animates its own content.
  const toolbarAnimatedStyle = useAnimatedStyle(() => ({
    height: Math.max(collapsedBarHeight, fullBarHeight * chromeProgress.value),
  }));
  // Phone layout overlays the bar on the WebView layer in a fixed box
  // (touches pass through via box-none); the WebView itself ends above it.
  const toolbarOverlayStyle = useMemo(
    () => ({ height: fullBarHeight }),
    [fullBarHeight],
  );
  // The header (an overlay) slides with progress, while the space it takes
  // in the layout only follows layoutExpanded. The WebView follows the
  // header with a transform over that difference, so during a morph nothing
  // is laid out again: the layout changes once, with layoutExpanded, in the
  // same commit as this offset, so the page doesn't jump.
  const webPageShiftStyle = useAnimatedStyle(() => ({
    transform: [
      {
        translateY:
          BROWSER_HEADER_HEIGHT * (chromeProgress.value - layoutExpanded.value),
      },
    ],
  }));
  // Phone layout (used with webPageShiftStyle): the WebView ends above the
  // bar (above the collapsed pill's strip once collapsed), so the chrome
  // never covers page content. During a morph the part passing behind the
  // bar is hidden by the bar's page-colored strip; on iPhone the page keeps
  // drawing under the bar instead (PAGE_DRAWS_UNDER_BROWSER_BAR).
  const webPageBottomStyle = useAnimatedStyle(() => ({
    bottom: layoutExpanded.value ? fullBarHeight : collapsedBarHeight,
  }));

  return {
    handleScroll,
    expandBrowserChrome,
    chromeProgress,
    layoutExpanded,
    toolbarAnimatedStyle,
    toolbarOverlayStyle,
    webPageBottomStyle,
    webPageShiftStyle,
  };
}

export default useMobileBrowserChromeAnimation;
