import { useEffect } from 'react';
import type { ReactNode } from 'react';

import { StyleSheet } from 'react-native';
import Animated, {
  Easing,
  cancelAnimation,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

import { Stack, useTheme } from '@onekeyhq/components';

type IProps = {
  children: ReactNode;
  // Changing this prop re-triggers the pulse animation.
  // `undefined` / unchanged value = idle.
  signal?: number;
  borderRadius?: number;
  ringColor?: string;
};

const PULSE_DURATION_MS = 600;
const PULSE_REPEAT = 4; // 2 full fade in/out cycles

export function AttentionPulse({
  children,
  signal,
  borderRadius = 999,
  ringColor,
}: IProps) {
  const theme = useTheme();
  const color = ringColor ?? theme.borderInfo.val;
  const progress = useSharedValue(0);

  useEffect(() => {
    if (!signal) return undefined;
    progress.value = 0;
    progress.value = withRepeat(
      withTiming(1, {
        duration: PULSE_DURATION_MS,
        easing: Easing.inOut(Easing.ease),
      }),
      PULSE_REPEAT,
      true,
    );
    return () => {
      cancelAnimation(progress);
      progress.value = 0;
    };
  }, [signal, progress]);

  const ringStyle = useAnimatedStyle(() => ({
    opacity: interpolate(progress.value, [0, 1], [0, 0.9]),
  }));

  return (
    <Stack position="relative">
      {children}
      <Animated.View
        pointerEvents="none"
        style={[
          StyleSheet.absoluteFill,
          {
            borderRadius,
            borderWidth: 2,
            borderColor: color,
          },
          ringStyle,
        ]}
      />
    </Stack>
  );
}
