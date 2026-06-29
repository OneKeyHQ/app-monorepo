import { useEffect } from 'react';

import Animated, {
  Easing,
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

import { useTheme } from '@onekeyhq/components';

const BREATH_DURATION_MS = 850;
const DOT_SIZE = 6;

// A small dot with a gentle, infinite "breathing" pulse (opacity + scale),
// shown before the "Pending" label in the swap history preview badge to make
// the in-flight state feel alive. Mounts only for pending rows, so the loop is
// cancelled as soon as the item finishes (the dot unmounts).
export function SwapHistoryPendingDot() {
  const theme = useTheme();
  const color = theme.textInfo.val;
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = withRepeat(
      withTiming(1, {
        duration: BREATH_DURATION_MS,
        easing: Easing.inOut(Easing.ease),
      }),
      -1, // repeat forever
      true, // reverse each cycle => breathe in and out
    );
    return () => {
      cancelAnimation(progress);
    };
  }, [progress]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: 0.4 + progress.value * 0.6,
    transform: [{ scale: 0.82 + progress.value * 0.18 }],
  }));

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        {
          width: DOT_SIZE,
          height: DOT_SIZE,
          borderRadius: DOT_SIZE / 2,
          backgroundColor: color,
        },
        animatedStyle,
      ]}
    />
  );
}
