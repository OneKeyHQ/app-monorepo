import { useEffect } from 'react';
import type { ReactNode } from 'react';

import { StyleSheet } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { Stack } from '@onekeyhq/components';

// A two-sided card that flips around its vertical axis (rotateY) to reveal the
// back plate, instead of stacking front/back vertically. The front face is in
// normal flow so it defines the card height; the back face is overlaid with
// absoluteFill (front/back plates are the same 12-row height). backfaceVisibility
// hides the away-facing side on web; the opacity snap at the 90° edge-on point
// is the cross-platform fallback for runtimes where backfaceVisibility is flaky.
const styles = StyleSheet.create({
  face: { backfaceVisibility: 'hidden' },
});

export function KeyTagFlipCard({
  flipped,
  front,
  back,
}: {
  flipped: boolean;
  front: ReactNode;
  back: ReactNode;
}) {
  const progress = useSharedValue(flipped ? 1 : 0);
  const reducedMotion = useReducedMotion();

  useEffect(() => {
    const to = flipped ? 1 : 0;
    // Reduced motion: snap between faces instead of the 3D rotateY, matching
    // the plate entrance and number-pulse. Forced verify can flip on every
    // failed Confirm, so the spin adds up.
    progress.value = reducedMotion ? to : withTiming(to, { duration: 520 });
  }, [flipped, progress, reducedMotion]);

  const frontStyle = useAnimatedStyle(() => ({
    opacity: progress.value <= 0.5 ? 1 : 0,
    transform: [
      { perspective: 1200 },
      { rotateY: `${progress.value * 180}deg` },
    ],
  }));

  const backStyle = useAnimatedStyle(() => ({
    opacity: progress.value > 0.5 ? 1 : 0,
    transform: [
      { perspective: 1200 },
      { rotateY: `${progress.value * 180 - 180}deg` },
    ],
  }));

  return (
    <Stack>
      <Animated.View
        pointerEvents={flipped ? 'none' : 'auto'}
        style={[styles.face, frontStyle]}
      >
        {front}
      </Animated.View>
      <Animated.View
        pointerEvents={flipped ? 'auto' : 'none'}
        style={[StyleSheet.absoluteFill, styles.face, backStyle]}
      >
        {back}
      </Animated.View>
    </Stack>
  );
}
