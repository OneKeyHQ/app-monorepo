import { useCallback, useEffect } from 'react';

import {
  runOnUI,
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

// Sentinel for "undefined" in SharedValue (SharedValue<number> can't hold undefined)
const UNSET = -1;

function useMobileBottomBarAnimation(activeTabId: string | null) {
  const { bottom: bottomInset } = useSafeAreaInsets();
  const fullBarHeight = BROWSER_BOTTOM_BAR_HEIGHT + bottomInset;
  const toolbarHeight = useSharedValue(fullBarHeight);
  const toolbarOpacity = useSharedValue(MAX_OPACITY_BOTTOM_BAR);
  const lastScrollY = useSharedValue(UNSET);
  const lastTurnScrollY = useSharedValue(UNSET);

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
        toolbarHeight.value = withTiming(fullBarHeight);
        toolbarOpacity.value = withTiming(MAX_OPACITY_BOTTOM_BAR);
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
      const height = distanceOffsetY < 0 ? fullBarHeight : 0;

      toolbarHeight.value = withTiming(height, {
        duration: DISPLAY_BOTTOM_BAR_DURATION,
      });
      toolbarOpacity.value = withTiming(height / fullBarHeight, {
        duration: DISPLAY_BOTTOM_BAR_DURATION,
      });
    },
    [
      fullBarHeight,
      lastScrollY,
      lastTurnScrollY,
      toolbarHeight,
      toolbarOpacity,
    ],
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
        Math.round(
          layoutMeasurement.height + contentInset.top + contentInset.bottom,
        ) +
          MIN_TOGGLE_BROWSER_VISIBLE_DISTANCE +
          fullBarHeight;

      runOnUI(processScroll)(contentOffsetY, canScroll, isOutOfBounds);
    },
    [fullBarHeight, processScroll],
  );

  const toolbarAnimatedStyle = useAnimatedStyle(() => ({
    height: toolbarHeight.value,
    opacity: toolbarOpacity.value,
  }));

  // Reset toolbar animation state when activeTabId changes.
  useEffect(() => {
    toolbarHeight.value = withTiming(fullBarHeight);
    toolbarOpacity.value = withTiming(MAX_OPACITY_BOTTOM_BAR);
    runOnUI(() => {
      'worklet';

      lastScrollY.value = UNSET;
      lastTurnScrollY.value = UNSET;
    })();

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTabId, fullBarHeight]);

  return {
    handleScroll,
    toolbarAnimatedStyle,
  };
}

export default useMobileBottomBarAnimation;
