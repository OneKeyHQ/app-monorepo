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

import { LinearGradient, Stack } from '@onekeyhq/components';

import SignGuardIcon from '../SimilarAddressDialog/SignGuardIcon';

const ICON_WIDTH = 80;
const SHIMMER_BAND = 24;

function ShimmerSignGuard() {
  const reducedMotion = useReducedMotion();
  const translate = useSharedValue(-SHIMMER_BAND);
  const END = ICON_WIDTH + SHIMMER_BAND;
  const START = -SHIMMER_BAND;
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
        sweep(END, FAST),
        reset(START),
        sweep(END, FAST),
        reset(START),
        withDelay(200, sweep(END, SLOW)),
      ),
    );
  }, [translate, END, START, FAST, SLOW, reducedMotion]);

  const shimmerStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translate.value }],
  }));

  return (
    <Stack style={{ width: ICON_WIDTH, height: 14, overflow: 'hidden' }}>
      <SignGuardIcon width={ICON_WIDTH} height={14} />
      {reducedMotion ? null : (
        <Animated.View
          style={[
            {
              position: 'absolute',
              top: 0,
              bottom: 0,
              width: SHIMMER_BAND,
            },
            shimmerStyle,
          ]}
          pointerEvents="none"
        >
          <LinearGradient
            colors={['transparent', 'rgba(255,255,255,0.25)', 'transparent']}
            start={{ x: 0, y: 0.5 }}
            end={{ x: 1, y: 0.5 }}
            style={{ flex: 1 }}
          />
        </Animated.View>
      )}
    </Stack>
  );
}

export { ShimmerSignGuard };
