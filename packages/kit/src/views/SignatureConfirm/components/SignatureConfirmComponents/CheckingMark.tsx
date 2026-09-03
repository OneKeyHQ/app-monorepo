import { useEffect } from 'react';

import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

import { Stack } from '@onekeyhq/components';

const SIZE = 16;
const BORDER = 2;
const SPIN_MS = 800;
const SIZE_STYLE = { width: SIZE, height: SIZE } as const;

function CheckingMark({ accessibilityLabel }: { accessibilityLabel: string }) {
  const reducedMotion = useReducedMotion();
  const rotation = useSharedValue(0);

  useEffect(() => {
    if (reducedMotion) {
      rotation.value = 0;
      return;
    }
    rotation.value = withRepeat(
      withTiming(360, { duration: SPIN_MS, easing: Easing.linear }),
      -1,
      false,
    );
  }, [reducedMotion, rotation]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${rotation.value}deg` }],
  }));

  return (
    <Animated.View
      accessibilityLabel={accessibilityLabel}
      pointerEvents="none"
      style={[SIZE_STYLE, animatedStyle]}
    >
      <Stack
        width={SIZE}
        height={SIZE}
        borderRadius={SIZE / 2}
        borderWidth={BORDER}
        borderColor="$neutral5"
        borderTopColor="$iconSubdued"
      />
    </Animated.View>
  );
}

export { CheckingMark };
