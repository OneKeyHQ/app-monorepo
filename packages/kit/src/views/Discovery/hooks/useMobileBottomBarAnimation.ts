import { createRef, useCallback, useEffect, useMemo, useRef } from 'react';
import type { Component } from 'react';

import {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import type { IWebViewOnScrollEvent } from '@onekeyhq/kit/src/components/WebView/types';

import {
  BROWSER_BOTTOM_BAR_HEIGHT,
  DISPLAY_BOTTOM_BAR_DURATION,
  MAX_OPACITY_BOTTOM_BAR,
  MIN_TOGGLE_BROWSER_VISIBLE_DISTANCE,
} from '../config/Animation.constants';

import type { ViewProps } from 'react-native';
import type { AnimateProps } from 'react-native-reanimated';

function useMobileBottomBarAnimation(activeTabId: string | null) {
  const toolbarRef = useMemo(() => createRef<any>(), []);
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
          BROWSER_BOTTOM_BAR_HEIGHT;

      // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
      toolbarRef?.current?.setNativeProps?.({
        position: webViewCanScroll ? 'absolute' : 'relative',
      });
      if (!webViewCanScroll) {
        toolbarHeight.value = withTiming(BROWSER_BOTTOM_BAR_HEIGHT);
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
      const height = distanceOffsetY < 0 ? BROWSER_BOTTOM_BAR_HEIGHT : 0;

      toolbarHeight.value = withTiming(height, {
        duration: DISPLAY_BOTTOM_BAR_DURATION,
      }); // No gradual animation
      toolbarOpacity.value = withTiming(height / BROWSER_BOTTOM_BAR_HEIGHT, {
        duration: DISPLAY_BOTTOM_BAR_DURATION,
      }); // No gradual animation
    },
    [toolbarHeight, toolbarOpacity, toolbarRef],
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

    // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
    toolbarRef?.current?.setNativeProps?.({
      position: 'relative',
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTabId]);

  return {
    handleScroll,
    toolbarRef,
    toolbarAnimatedStyle,
  };
}

export default useMobileBottomBarAnimation;
