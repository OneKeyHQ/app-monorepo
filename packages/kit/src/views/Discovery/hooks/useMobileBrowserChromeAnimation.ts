import { useCallback, useMemo, useRef } from 'react';

import {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import { useSafeAreaInsets } from '@onekeyhq/components';
import type { IWebViewOnScrollEvent } from '@onekeyhq/kit/src/components/WebView/types';

import {
  CHROME_FOLLOWS_SCROLL,
  getBarReservedHeight,
  getCollapsedReservedHeight,
} from '../components/MobileBrowser/browserChrome';
import {
  BROWSER_CHROME_CROSSFADE_POINT,
  BROWSER_CHROME_SETTLE_DURATION,
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

// Following the finger (CHROME_FOLLOWS_SCROLL) needs the WebView's
// isInteracting (patched in on iOS); other scroll sources (the Explore
// dashboard) keep the direction trigger below.
// Telegram's settle curve.
const settleTiming = {
  duration: BROWSER_CHROME_SETTLE_DURATION,
  easing: Easing.inOut(Easing.ease),
};

// Drives the mobile browser chrome (header + bottom bar) from WebView scroll:
// scrolling down collapses both; scrolling up, reaching an edge of the page,
// or a non-scrollable page brings them back.
function useMobileBrowserChromeAnimation() {
  const { top: safeTop, bottom: bottomInset } = useSafeAreaInsets();
  const fullBarHeight = getBarReservedHeight(bottomInset);
  // How much taller the WebView's frame is while the chrome is collapsed: the
  // header gives up its spacer and the bar gives up the room the collapsed pill
  // needs. The frame changes by this much whenever layoutExpanded flips, so
  // anything that reasons about the scrollable range has to pick one layout and
  // stay on it, or the target keeps moving under the chrome.
  const layoutHeightDelta =
    BROWSER_HEADER_HEIGHT +
    (fullBarHeight - getCollapsedReservedHeight(bottomInset));
  // Scrolling this far collapses (or expands) the chrome while following:
  // the header's full height with the status bar above it, as Telegram uses
  // its navigation height (~100pt on notched iPhones), so the chrome doesn't
  // race ahead of the page.
  const followDistance = BROWSER_HEADER_HEIGHT + safeTop;
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
  // Scroll tracking stays on the JS thread, where WebView scroll events
  // arrive (one per frame). The direction trigger touches the UI thread only
  // when the chrome has to animate, about twice per gesture; following the
  // finger (iPhone) writes the progress on every event that moves it.
  const lastScrollYRef = useRef<number | undefined>(undefined);
  const lastTurnScrollYRef = useRef<number | undefined>(undefined);
  // Where the chrome is headed (or rests): an animation's target, or the
  // progress the finger set while following.
  const targetRef = useRef(EXPANDED);
  // Whether targetRef was reached by an animation (or is one's target), as
  // opposed to set by following, where the layout may still need to settle.
  const isSettledRef = useRef(true);
  // Whether this side last set the WebView's collapsed layout, so following
  // writes it once per gesture rather than on every event. Cleared when an
  // expand is requested (its end restores the expanded layout on the UI
  // thread), at worst costing one repeated write.
  const layoutCollapsedRef = useRef(false);
  // Whether a gesture is already being followed, so its first event is the
  // only one that reads chromeProgress.value (see followScroll).
  const isFollowingRef = useRef(false);
  const setLayoutCollapsed = useCallback(() => {
    if (!layoutCollapsedRef.current) {
      layoutCollapsedRef.current = true;
      layoutExpanded.value = COLLAPSED;
    }
  }, [layoutExpanded]);
  // Room the collapsed pill needs when the bar is laid out in-flow (tablets).
  const collapsedBarHeight = getCollapsedReservedHeight(bottomInset);

  const animateTo = useCallback(
    (target: number, curve: 'spring' | 'settle' = 'spring') => {
      isFollowingRef.current = false;
      if (targetRef.current === target && isSettledRef.current) {
        return;
      }
      targetRef.current = target;
      isSettledRef.current = true;
      if (target === COLLAPSED) {
        setLayoutCollapsed();
      } else {
        layoutCollapsedRef.current = false;
      }
      const onEnd = (finished?: boolean) => {
        'worklet';

        if (finished && target === EXPANDED) {
          layoutExpanded.value = EXPANDED;
        }
      };
      chromeProgress.value =
        curve === 'settle'
          ? withTiming(target, settleTiming, onEnd)
          : withSpring(target, springConfig, onEnd);
    },
    [chromeProgress, layoutExpanded, setLayoutCollapsed],
  );

  // Follows the finger (see CHROME_FOLLOWS_SCROLL). The WebView takes its
  // larger, collapsed size as soon as the chrome starts to leave, and its
  // smaller one only once the chrome settles fully expanded, so it resizes
  // at most twice per gesture rather than on every frame.
  const followScroll = useCallback(
    (
      scrollY: number,
      maxScrollY: number,
      contentTopInset: number,
      isInteracting: boolean,
    ) => {
      const lastY = lastScrollYRef.current;
      lastScrollYRef.current = scrollY;
      // The first event of a finger-tracking gesture resumes from where the
      // chrome is drawn, not from targetRef: starting a drag during a settle
      // finds the target already at 0 or 1 while the animation is still
      // between the two, so its first delta would snap the chrome to a
      // different position. Later events use targetRef, since reading the
      // shared value on the JS thread blocks until the UI thread answers and
      // deceleration would pay that on every frame.
      let next = targetRef.current;
      if (isInteracting && !isFollowingRef.current) {
        isFollowingRef.current = true;
        next = chromeProgress.value;
      }
      if (lastY !== undefined) {
        next -= (scrollY - lastY) / followDistance;
      }
      // Near an edge the chrome comes back in step with the distance left,
      // fully at the edge itself, like Telegram.
      const toBottom = Math.max(0, maxScrollY - scrollY);
      const toTop = Math.max(0, scrollY + contentTopInset);
      // The bottom zone is measured on the frame change, not on the bar height:
      // collapsing the layout moves the page's bottom edge up by
      // layoutHeightDelta, so anything less than that from the bottom would
      // become an overscroll and spring back. On an iPhone with no bottom inset
      // the frame change (66) is larger than the bar (62), so a bar-sized zone
      // would leave a gap where the loop survives.
      const bottomZone = Math.max(fullBarHeight, layoutHeightDelta);
      const isNearBottom = toBottom < bottomZone;
      if (isNearBottom) {
        // Hold the chrome open here: the frame cannot shrink, and a chrome drawn
        // under 1 against an expanded frame would lift the page and the bar's
        // backdrop away from the screen bottom. While the finger is still down
        // and the layout is collapsed the frame is the taller one, so there is
        // room to ease in with the distance left instead of snapping from 0 to 1
        // (which also jumps the page by the header height).
        next =
          isInteracting && layoutCollapsedRef.current
            ? Math.max(next, 1 - toBottom / bottomZone)
            : EXPANDED;
      } else if (toTop < followDistance) {
        next = Math.max(next, 1 - toTop / followDistance);
      }
      next = Math.min(EXPANDED, Math.max(COLLAPSED, next));
      if (!isInteracting) {
        animateTo(
          next < BROWSER_CHROME_CROSSFADE_POINT ? COLLAPSED : EXPANDED,
          'settle',
        );
        return;
      }
      if (next === targetRef.current) {
        return;
      }
      targetRef.current = next;
      isSettledRef.current = false;
      if (next < EXPANDED) {
        setLayoutCollapsed();
      }
      // Replaces any running animation.
      chromeProgress.value = next;
    },
    [
      animateTo,
      chromeProgress,
      followDistance,
      fullBarHeight,
      layoutHeightDelta,
      setLayoutCollapsed,
    ],
  );

  const handleScroll = useCallback(
    ({ nativeEvent }: IWebViewOnScrollEvent) => {
      const {
        contentOffset,
        contentSize,
        contentInset,
        layoutMeasurement,
        isInteracting,
      } = nativeEvent;
      const contentOffsetY = contentOffset.y;
      // contentInset extends the scroll range, so the bounce zone starts
      // past it.
      const maxOffsetY =
        contentSize.height + contentInset.bottom - layoutMeasurement.height;
      const isOutOfBounds =
        contentOffsetY < -contentInset.top ||
        Math.round(contentOffsetY) > Math.round(maxOffsetY);
      // Measured against the expanded frame: the collapsed frame is
      // layoutHeightDelta taller, so a page that only just scrolls while
      // collapsed would read as not scrollable and flip the layout back and
      // forth (each flip resizes the WebView, so the chrome would oscillate).
      const scrollableViewportHeight =
        layoutMeasurement.height +
        (layoutCollapsedRef.current ? -layoutHeightDelta : 0);
      const canScroll =
        Math.round(contentSize.height) >
        Math.round(scrollableViewportHeight) +
          MIN_TOGGLE_BROWSER_VISIBLE_DISTANCE;

      if (CHROME_FOLLOWS_SCROLL && isInteracting !== undefined) {
        if (!canScroll) {
          lastScrollYRef.current = contentOffsetY;
          animateTo(EXPANDED);
          return;
        }
        followScroll(
          contentOffsetY,
          maxOffsetY,
          contentInset.top,
          isInteracting,
        );
        return;
      }

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
    [animateTo, followScroll, layoutHeightDelta],
  );

  const expandBrowserChrome = useCallback(() => {
    // Also the per-tab reset: Browser.native expands the chrome when the
    // active tab or its URL changes, so the next tab starts from a fresh
    // scroll baseline instead of the previous tab's offsets.
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
