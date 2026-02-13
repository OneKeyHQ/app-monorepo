import { useCallback, useEffect, useRef } from 'react';

import {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { useSafeAreaInsets } from '@onekeyhq/components';
import type { IWebViewOnScrollEvent } from '@onekeyhq/kit/src/components/WebView/types';

import {
  BROWSER_BOTTOM_BAR_HEIGHT,
  DISPLAY_BOTTOM_BAR_DURATION,
  MAX_OPACITY_BOTTOM_BAR,
  MIN_TOGGLE_BROWSER_VISIBLE_DISTANCE,
} from '../config/Animation.constants';

function useMobileBottomBarAnimation(activeTabId: string | null) {
  const { bottom: bottomInset } = useSafeAreaInsets();
  const fullBarHeight = BROWSER_BOTTOM_BAR_HEIGHT + bottomInset;
  const toolbarHeight = useSharedValue(fullBarHeight);
  const toolbarOpacity = useSharedValue(MAX_OPACITY_BOTTOM_BAR);
  const lastScrollY = useRef<number | undefined>(undefined);
  const lastTurnScrollY = useRef<number | undefined>(undefined);

  const handleScroll = useCallback(
    ({ nativeEvent }: IWebViewOnScrollEvent) => {
      const { contentOffset, contentSize, contentInset, layoutMeasurement } =
        nativeEvent;
      const contentOffsetY = contentOffset.y;
      if (
        contentOffsetY < 0 ||
        Math.round(contentOffsetY) >
          Math.round(
            contentSize.height -
              (layoutMeasurement.height +
                contentInset.top +
                contentInset.bottom),
          )
      ) {
        lastScrollY.current = undefined;
        lastTurnScrollY.current = undefined;
        return;
      }
      const webViewCanScroll =
        Math.round(contentSize.height) >
        Math.round(
          layoutMeasurement.height + contentInset.top + contentInset.bottom,
        ) +
          MIN_TOGGLE_BROWSER_VISIBLE_DISTANCE +
          fullBarHeight;

      if (!webViewCanScroll) {
        toolbarHeight.value = withTiming(fullBarHeight);
        toolbarOpacity.value = withTiming(MAX_OPACITY_BOTTOM_BAR);
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
      const height = distanceOffsetY < 0 ? fullBarHeight : 0;

      toolbarHeight.value = withTiming(height, {
        duration: DISPLAY_BOTTOM_BAR_DURATION,
      }); // No gradual animation
      toolbarOpacity.value = withTiming(height / fullBarHeight, {
        duration: DISPLAY_BOTTOM_BAR_DURATION,
      }); // No gradual animation
    },
    [toolbarHeight, toolbarOpacity, fullBarHeight],
  );
  const toolbarAnimatedStyle = useAnimatedStyle(() => ({
    height: toolbarHeight.value,
    opacity: toolbarOpacity.value,
  }));

  // Reset toolbar animation state when activeTabId changes.
  useEffect(() => {
    toolbarHeight.value = withTiming(fullBarHeight);
    toolbarOpacity.value = withTiming(MAX_OPACITY_BOTTOM_BAR);
    lastScrollY.current = undefined;
    lastTurnScrollY.current = undefined;

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTabId, fullBarHeight]);

  return {
    handleScroll,
    toolbarAnimatedStyle,
  };
}

export default useMobileBottomBarAnimation;
