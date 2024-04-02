import { useCallback, useEffect, useRef } from 'react';

import {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import {
  BROWSER_BOTTOM_BAR_HEIGHT,
  DISPLAY_BOTTOM_BAR_DURATION,
  MAX_OPACITY_BOTTOM_BAR,
  MIN_TOGGLE_BROWSER_VISIBLE_DISTANCE,
} from '../config/Animation.constants';

import type { IWebViewOnScrollEvent } from '../components/WebView/types';

function useMobileBottomBarAnimation(activeTabId: string | null) {
  const toolbarHeight = useSharedValue(BROWSER_BOTTOM_BAR_HEIGHT);
  const toolbarOpacity = useSharedValue(MAX_OPACITY_BOTTOM_BAR);
  const lastScrollY = useRef<number | undefined>(undefined);
  const lastTurnScrollY = useRef<number | undefined>(undefined);

  const handleScroll = useCallback(
    ({ nativeEvent }: IWebViewOnScrollEvent) => {
      const { contentOffset, contentSize, contentInset, layoutMeasurement } =
        nativeEvent;
      const contentOffsetY = contentOffset.y;
      if (
        Math.round(contentSize.height) <=
        Math.round(
          layoutMeasurement.height + contentInset.top + contentInset.bottom,
        )
      ) {
        return;
      }
      if (
        lastScrollY.current === undefined ||
        lastTurnScrollY.current === undefined ||
        (contentOffsetY - lastScrollY.current) *
          (lastScrollY.current - lastTurnScrollY.current) <
          0
      ) {
        lastTurnScrollY.current = lastScrollY.current;
      }
      lastScrollY.current = contentOffsetY;
      if (lastTurnScrollY.current === undefined) {
        return;
      }
      const distanceOffsetY = contentOffsetY - lastTurnScrollY.current;
      if (Math.abs(distanceOffsetY) <= MIN_TOGGLE_BROWSER_VISIBLE_DISTANCE) {
        return;
      }
      const height = distanceOffsetY < 0 ? BROWSER_BOTTOM_BAR_HEIGHT : 0;

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
    lastScrollY.current = undefined;
    lastTurnScrollY.current = undefined;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTabId]);

  return {
    handleScroll,
    toolbarAnimatedStyle,
  };
}

export default useMobileBottomBarAnimation;
