import { useCallback, useEffect, useMemo, useRef } from 'react';

import { StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import {
  ORDER_BOOK_DEPTH_WIDTH_TRANSITION_MS,
  ORDER_BOOK_SIDE_RATIO_TRANSITION_MS,
  normalizeDepthWidth,
} from './AnimatedDepthBlock.shared';

import type {
  IDepthBarProps,
  ISideRatioSegmentsProps,
} from './AnimatedDepthBlock.shared';
import type { LayoutChangeEvent } from 'react-native';

const DEFAULT_ROW_HEIGHT = 24;

const styles = StyleSheet.create({
  container: {
    position: 'relative',
    width: '100%',
    overflow: 'hidden',
  },
  block: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
  },
});

function useAnimatedOrderBookPercentage({
  duration,
  value,
}: {
  duration: number;
  value: number;
}) {
  const targetValue = Math.max(0, Math.min(100, value));
  const reducedMotion = useReducedMotion();
  const animatedValue = useSharedValue(targetValue);
  const isFirstRenderRef = useRef(true);

  useEffect(() => {
    if (isFirstRenderRef.current || reducedMotion) {
      isFirstRenderRef.current = false;
      animatedValue.value = targetValue;
      return;
    }

    animatedValue.value = withTiming(targetValue, {
      duration,
      easing: Easing.out(Easing.cubic),
    });
  }, [animatedValue, duration, reducedMotion, targetValue]);

  return animatedValue;
}

export function DepthBar({
  color,
  width,
  left,
  right,
  height,
  origin = 'left',
}: IDepthBarProps) {
  const targetWidth = useMemo(() => normalizeDepthWidth(width), [width]);
  const widthAnim = useAnimatedOrderBookPercentage({
    duration: ORDER_BOOK_DEPTH_WIDTH_TRANSITION_MS,
    value: targetWidth,
  });
  const blockWidth = useSharedValue(0);
  const handleLayout = useCallback(
    (event: LayoutChangeEvent) => {
      blockWidth.value = event.nativeEvent.layout.width;
    },
    [blockWidth],
  );
  const animatedStyle = useAnimatedStyle(() => {
    const scale = widthAnim.value / 100;
    const translateX =
      origin === 'right'
        ? ((1 - scale) * blockWidth.value) / 2
        : ((scale - 1) * blockWidth.value) / 2;

    return {
      transform: [{ translateX }, { scaleX: scale }],
    };
  });

  return (
    <View
      onLayout={handleLayout}
      style={[
        styles.container,
        {
          height: height ?? DEFAULT_ROW_HEIGHT,
          right,
          left,
        },
      ]}
    >
      <Animated.View
        style={[
          styles.block,
          {
            backgroundColor: color,
          },
          animatedStyle,
        ]}
      />
    </View>
  );
}

export function SideRatioSegments({
  bidPercentage,
  askPercentage,
  longColor,
  shortColor,
  segmentStyle,
  startSegmentStyle,
  endSegmentStyle,
}: ISideRatioSegmentsProps) {
  const bidSegmentFlex = useAnimatedOrderBookPercentage({
    duration: ORDER_BOOK_SIDE_RATIO_TRANSITION_MS,
    value: Math.max(bidPercentage, 1),
  });
  const askSegmentFlex = useAnimatedOrderBookPercentage({
    duration: ORDER_BOOK_SIDE_RATIO_TRANSITION_MS,
    value: Math.max(askPercentage, 1),
  });
  const bidSegmentStyle = useAnimatedStyle(() => ({
    flex: bidSegmentFlex.value,
  }));
  const askSegmentStyle = useAnimatedStyle(() => ({
    flex: askSegmentFlex.value,
  }));
  return (
    <>
      <Animated.View
        style={[
          segmentStyle,
          startSegmentStyle,
          bidSegmentStyle,
          {
            backgroundColor: longColor,
          },
        ]}
      />
      <Animated.View
        style={[
          segmentStyle,
          endSegmentStyle,
          askSegmentStyle,
          {
            backgroundColor: shortColor,
          },
        ]}
      />
    </>
  );
}
