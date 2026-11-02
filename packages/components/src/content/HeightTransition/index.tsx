import type { ComponentProps } from 'react';
import { useCallback, useEffect, useMemo } from 'react';

import { PixelRatio, StyleSheet } from 'react-native';
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import platformEnv from '@onekeyhq/shared/src/platformEnv';

import type { MotiView } from 'moti';

const styles = StyleSheet.create({
  autoBottom: {
    bottom: 'auto',
  },
  hidden: {
    overflow: 'hidden',
  },
});

export type IHeightTransitionProps = {
  children?: React.ReactNode;
  /**
   * If `true`, the height will automatically animate to 0. Default: `false`.
   */
  hide?: boolean;
  initialHeight?: number;
  onHeightDidAnimate?: (height: number) => void;
  /**
   * Timing duration in milliseconds for both the height and opacity animations.
   * Defaults to 80 on Android and 150 on other platforms.
   */
  duration?: number;
  /** Normalize layout precision before rounding up to avoid animation restarts. */
  roundHeightToNearestPixel?: boolean;
} & ComponentProps<typeof MotiView>;

// The animation duration on Android is twice that of iOS, so the duration has been shortened on Android.
const defaultTransitionDuration = platformEnv.isNativeAndroid ? 80 : 150;

function HeightTransition({
  children,
  hide = !children,
  style,
  onHeightDidAnimate,
  initialHeight = 0,
  duration = defaultTransitionDuration,
  roundHeightToNearestPixel = false,
}: IHeightTransitionProps) {
  const measuredHeight = useSharedValue(initialHeight);
  const transition = useMemo(() => ({ duration }), [duration]);

  // On Android with Fabric/New Architecture, guard against stale worklet
  // callbacks that can cause SIGSEGV in Value::~Value during navigation
  // transitions. This shared value is checked on the UI thread inside
  // withTiming completion callbacks to skip runOnJS calls after unmount.
  const isMounted = useSharedValue(1);
  useEffect(
    () => () => {
      isMounted.value = 0;
    },
    [isMounted],
  );

  const childStyle = useAnimatedStyle(
    () => ({
      opacity: withTiming(!measuredHeight.value || hide ? 0 : 1, transition),
    }),
    [hide, measuredHeight, transition],
  );

  const containerStyle = useAnimatedStyle(
    () => ({
      height: withTiming(hide ? 0 : measuredHeight.value, transition, () => {
        if (onHeightDidAnimate && isMounted.value) {
          runOnJS(onHeightDidAnimate)(measuredHeight.value);
        }
      }),
    }),
    [hide, measuredHeight, isMounted, transition],
  );

  const handleLayout = useCallback(
    ({ nativeEvent }: { nativeEvent: { layout: { height: number } } }) => {
      const height = nativeEvent.layout.height;
      // Centered iOS layouts can report 130.00003 for 130 as they move.
      // Snap before ceil so that noise cannot restart the height animation.
      measuredHeight.value = Math.ceil(
        roundHeightToNearestPixel
          ? PixelRatio.roundToNearestPixel(height)
          : height,
      );
    },
    [measuredHeight, roundHeightToNearestPixel],
  );

  const outerStyle = useMemo(
    () => [styles.hidden, style, containerStyle],
    [style, containerStyle],
  );

  const innerStyle = useMemo(
    () => [StyleSheet.absoluteFill, styles.autoBottom, childStyle],
    [childStyle],
  );

  return (
    <Animated.View style={outerStyle}>
      <Animated.View style={innerStyle} onLayout={handleLayout}>
        {children}
      </Animated.View>
    </Animated.View>
  );
}

export { HeightTransition };
