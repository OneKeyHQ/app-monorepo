import { useEffect } from 'react';

import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import { Stack } from '@onekeyhq/components';

import SignGuardIcon, {
  SIGN_GUARD_ICON_HEIGHT,
  SIGN_GUARD_ICON_WIDTH,
} from '../SimilarAddressDialog/SignGuardIcon';
const SHEEN_OPACITY = 0.45;
const SHEEN_TILT_DEG = -18;

function ShimmerSignGuard({
  width = SIGN_GUARD_ICON_WIDTH,
  height = SIGN_GUARD_ICON_HEIGHT,
}: {
  width?: number;
  height?: number;
}) {
  const reducedMotion = useReducedMotion();
  const band = Math.max(16, Math.round(width * 0.3));
  const translate = useSharedValue(-band);
  const end = width + band;
  const start = -band;
  const FAST = 350;
  const SLOW = 1500;

  useEffect(() => {
    if (reducedMotion) {
      return;
    }
    const sweep = (v: number, d: number) =>
      withTiming(v, { duration: d, easing: Easing.inOut(Easing.sin) });
    const reset = (v: number) => withTiming(v, { duration: 0 });

    translate.value = withDelay(
      1200,
      withSequence(
        sweep(end, FAST),
        reset(start),
        sweep(end, FAST),
        reset(start),
        withDelay(200, sweep(end, SLOW)),
      ),
    );
  }, [translate, end, start, FAST, SLOW, reducedMotion]);

  const clipStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: translate.value },
      { rotate: `${SHEEN_TILT_DEG}deg` },
    ],
  }));
  const contentStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: -translate.value },
      { rotate: `${-SHEEN_TILT_DEG}deg` },
    ],
  }));

  return (
    <Stack
      accessibilityRole="image"
      accessibilityLabel="SignGuard"
      style={{ width, height, overflow: 'hidden' }}
    >
      <SignGuardIcon
        width={width}
        height={height}
        accessibilityRole={undefined}
      />
      {reducedMotion ? null : (
        <Animated.View
          pointerEvents="none"
          style={[
            {
              position: 'absolute',
              top: -height,
              left: 0,
              width: band,
              height: height * 3,
              overflow: 'hidden',
              opacity: SHEEN_OPACITY,
            },
            clipStyle,
          ]}
        >
          <Animated.View
            style={[
              { position: 'absolute', top: height, left: 0, width },
              contentStyle,
            ]}
          >
            <SignGuardIcon
              sheen
              width={width}
              height={height}
              accessibilityRole={undefined}
            />
          </Animated.View>
        </Animated.View>
      )}
    </Stack>
  );
}

export { ShimmerSignGuard };
