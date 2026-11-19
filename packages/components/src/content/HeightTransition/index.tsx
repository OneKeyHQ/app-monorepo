import type { ComponentProps } from 'react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { PixelRatio, StyleSheet } from 'react-native';
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import platformEnv from '@onekeyhq/shared/src/platformEnv';

import type { MotiView } from 'moti';
import type { WithTimingConfig } from 'react-native-reanimated';

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
   * Timing duration in milliseconds for the height animation.
   * Defaults to 80 on Android and 150 on other platforms.
   */
  duration?: number;
  /** Defaults to the height duration. */
  opacityDuration?: number;
  /** Defaults to Reanimated's timing easing. */
  easing?: WithTimingConfig['easing'];
  /** Normalize layout precision before rounding up to avoid animation restarts. */
  roundHeightToNearestPixel?: boolean;
  /** Show content at its measured height on first render; animate later changes. */
  skipInitialAnimation?: boolean;
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
  opacityDuration = duration,
  easing,
  roundHeightToNearestPixel = false,
  skipInitialAnimation = false,
}: IHeightTransitionProps) {
  const measuredHeight = useSharedValue(initialHeight);
  const transition = useMemo(
    () => ({ duration, ...(easing ? { easing } : {}) }),
    [duration, easing],
  );
  const opacityTransition = useMemo(
    () => ({ duration: opacityDuration, ...(easing ? { easing } : {}) }),
    [opacityDuration, easing],
  );
  const [isInitialPending, setIsInitialPending] =
    useState(skipInitialAnimation);
  const isInitialPendingRef = useRef(skipInitialAnimation);
  const [isUnmeasured, setIsUnmeasured] = useState(skipInitialAnimation);
  const initialAnimationFrameRef = useRef<number | undefined>(undefined);
  useEffect(
    () => () => {
      if (initialAnimationFrameRef.current !== undefined) {
        cancelAnimationFrame(initialAnimationFrameRef.current);
      }
    },
    [],
  );

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

  const childStyle = useAnimatedStyle(() => {
    const opacity = hide || (!measuredHeight.value && !isUnmeasured) ? 0 : 1;
    return {
      opacity: isInitialPending
        ? opacity
        : withTiming(opacity, opacityTransition),
    };
  }, [hide, isInitialPending, isUnmeasured, measuredHeight, opacityTransition]);

  const containerStyle = useAnimatedStyle(() => {
    if (isUnmeasured && !hide) return {};
    const height = hide ? 0 : measuredHeight.value;
    return {
      height: isInitialPending
        ? height
        : withTiming(height, transition, () => {
            if (onHeightDidAnimate && isMounted.value) {
              runOnJS(onHeightDidAnimate)(measuredHeight.value);
            }
          }),
    };
  }, [
    hide,
    isInitialPending,
    isUnmeasured,
    measuredHeight,
    isMounted,
    transition,
  ]);

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
      if (isInitialPendingRef.current && height > 0) {
        isInitialPendingRef.current = false;
        setIsUnmeasured(false);
        initialAnimationFrameRef.current = requestAnimationFrame(() => {
          initialAnimationFrameRef.current = requestAnimationFrame(() => {
            initialAnimationFrameRef.current = undefined;
            setIsInitialPending(false);
          });
        });
      }
    },
    [measuredHeight, roundHeightToNearestPixel],
  );

  const outerStyle = useMemo(
    () => [styles.hidden, style, containerStyle],
    [style, containerStyle],
  );

  const innerStyle = useMemo(
    () =>
      skipInitialAnimation
        ? childStyle
        : [StyleSheet.absoluteFill, styles.autoBottom, childStyle],
    [childStyle, skipInitialAnimation],
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
