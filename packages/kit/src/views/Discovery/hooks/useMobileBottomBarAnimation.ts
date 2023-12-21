import { useCallback, useEffect, useRef } from 'react';

import {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import {
  BROWSER_BOTTOM_BAR_HEIGHT,
  DISPLAY_BOTTOM_BAR_DURATION,
  IGNORE_INITIAL_EVENT_COUNT,
  MAX_OPACITY_BOTTOM_BAR,
  THROTTLE_TIME,
  THROTTLE_TIME_WHEN_REACH_BOTTOM,
} from '../config/Animation.constants';

import type { WebViewScrollEvent } from 'react-native-webview/lib/WebViewTypes';

function useMobileBottomBarAnimation(activeTabId: string | null) {
  const toolbarHeight = useSharedValue(BROWSER_BOTTOM_BAR_HEIGHT);
  const toolbarOpacity = useSharedValue(MAX_OPACITY_BOTTOM_BAR);
  const lastScrollY = useRef(0); // Keep track of the last scroll position
  const lastScrollEventTimeRef = useRef(0);
  const initialEventsCounterRef = useRef(0);

  const handleScroll = useCallback(
    ({ nativeEvent }: WebViewScrollEvent) => {
      const { contentSize, contentOffset, layoutMeasurement } = nativeEvent;
      const contentOffsetY = contentOffset.y;
      let throttleTime = THROTTLE_TIME;

      // Reached bottom of the page
      if (
        contentOffset.y + layoutMeasurement.height >=
        contentSize.height - BROWSER_BOTTOM_BAR_HEIGHT
      ) {
        throttleTime = THROTTLE_TIME_WHEN_REACH_BOTTOM;
      }

      const now = Date.now();
      if (now - lastScrollEventTimeRef.current < throttleTime) {
        if (initialEventsCounterRef.current > IGNORE_INITIAL_EVENT_COUNT) {
          return;
        }
        initialEventsCounterRef.current += 1;
      }

      lastScrollEventTimeRef.current = now;

      // console.log('Common Scroll Logic');
      // Determine the direction of the scroll
      const isScrollingDown = contentOffsetY < lastScrollY.current;
      lastScrollY.current = contentOffsetY;

      const height = isScrollingDown
        ? BROWSER_BOTTOM_BAR_HEIGHT
        : Math.min(
            BROWSER_BOTTOM_BAR_HEIGHT,
            Math.max(0, BROWSER_BOTTOM_BAR_HEIGHT - contentOffsetY),
          );

      toolbarHeight.value = withTiming(height, {
        duration: DISPLAY_BOTTOM_BAR_DURATION,
      }); // No gradual animation
      toolbarOpacity.value = withTiming(height / BROWSER_BOTTOM_BAR_HEIGHT, {
        duration: DISPLAY_BOTTOM_BAR_DURATION,
      }); // No gradual animation
    },
    [toolbarHeight, toolbarOpacity],
  );
  const toolbarAnimatedStyle = useAnimatedStyle(() => ({
    height: toolbarHeight.value,
    opacity: toolbarOpacity.value,
  }));

  // Reset toolbar animation state when activeTabId changes.
  useEffect(() => {
    toolbarHeight.value = withTiming(BROWSER_BOTTOM_BAR_HEIGHT);
    toolbarOpacity.value = withTiming(MAX_OPACITY_BOTTOM_BAR);
    initialEventsCounterRef.current = 0;
    lastScrollEventTimeRef.current = 0;
    lastScrollY.current = 0;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTabId]);

  return {
    handleScroll,
    toolbarAnimatedStyle,
  };
}

export default useMobileBottomBarAnimation;
