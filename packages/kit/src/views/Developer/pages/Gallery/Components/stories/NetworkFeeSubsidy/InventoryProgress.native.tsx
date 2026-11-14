import { useEffect } from 'react';

import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { Stack } from '@onekeyhq/components';

export function InventoryProgress({ value }: { value: number }) {
  const target = Math.max(0, Math.min(100, value));
  const reducedMotion = useReducedMotion();
  const progress = useSharedValue(reducedMotion ? target : 0);

  useEffect(() => {
    progress.value = reducedMotion
      ? target
      : withTiming(target, {
          duration: 450,
          easing: Easing.bezier(0.25, 0.1, 0.25, 1),
        });
  }, [progress, reducedMotion, target]);

  const fillStyle = useAnimatedStyle(() => ({
    width: `${progress.value}%`,
    height: '100%',
  }));

  return (
    <Stack
      accessibilityRole="progressbar"
      accessibilityValue={{ min: 0, max: 100, now: Math.round(target) }}
      h="$1"
      bg="$bgStrong"
      borderRadius="$full"
      overflow="hidden"
    >
      <Animated.View style={fillStyle}>
        <Stack flex={1} bg="$bgAccent" borderRadius="$full" />
      </Animated.View>
    </Stack>
  );
}
