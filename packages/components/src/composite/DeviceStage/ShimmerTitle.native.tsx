import { useCallback, useEffect, useMemo, useState } from 'react';

import MaskedView from '@react-native-masked-view/masked-view';
import { LinearGradient } from 'expo-linear-gradient';
import { StyleSheet } from 'react-native';
import Animated, {
  Easing,
  cancelAnimation,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import { SizableText, Stack } from '../../primitives';

import type { LayoutChangeEvent } from 'react-native';

/**
 * The capsule's live title: the words themselves carry the "working on
 * it" signal, a bright band sweeping left-to-right through dimmed glyphs
 * — the thinking-text grammar. Built the way the replica's port mask is:
 * the text is the mask, a dim fill and a traveling gradient play behind
 * it. Under reduced motion the sweep stands down and the words simply
 * show.
 */

const AnimatedLinearGradient = Animated.createAnimatedComponent(LinearGradient);

/** Width of the bright band, pt. */
const BAND_WIDTH = 72;
/** One full sweep across the words. */
const SWEEP_MS = 1400;
const BAND_COLORS = [
  'rgba(255,255,255,0)',
  '#FFFFFF',
  'rgba(255,255,255,0)',
] as const;

const GRADIENT_START = { x: 0, y: 0.5 };
const GRADIENT_END = { x: 1, y: 0.5 };

const styles = StyleSheet.create({
  band: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    width: BAND_WIDTH,
  },
});

export function ShimmerTitle({
  children,
  paused,
}: {
  children: string;
  /** The sweep stands down (band parked off the words) while the title
   * is mounted but hidden; clearing it restarts the sweep from the left. */
  paused?: boolean;
}) {
  const reducedMotion = useReducedMotion();
  const [textWidth, setTextWidth] = useState(0);
  const handleTextLayout = useCallback((event: LayoutChangeEvent) => {
    setTextWidth(Math.ceil(event.nativeEvent.layout.width));
  }, []);
  const bandX = useSharedValue(-BAND_WIDTH);
  useEffect(() => {
    if (reducedMotion || !textWidth || paused) {
      bandX.value = -BAND_WIDTH;
      return undefined;
    }
    bandX.value = withRepeat(
      withSequence(
        withTiming(-BAND_WIDTH, { duration: 0 }),
        withTiming(textWidth, {
          duration: SWEEP_MS,
          easing: Easing.inOut(Easing.ease),
        }),
      ),
      -1,
      false,
    );
    return () => cancelAnimation(bandX);
  }, [bandX, paused, reducedMotion, textWidth]);
  const bandMotionStyle = useAnimatedStyle(
    () => ({ transform: [{ translateX: bandX.value }] }),
    [bandX],
  );
  const bandStyle = useMemo(
    () => [styles.band, bandMotionStyle],
    [bandMotionStyle],
  );
  const maskElement = useMemo(
    () => <SizableText size="$headingMd">{children}</SizableText>,
    [children],
  );
  if (reducedMotion) {
    return (
      <SizableText size="$headingMd" color="$textSubdued">
        {children}
      </SizableText>
    );
  }
  return (
    <MaskedView maskElement={maskElement}>
      {/* Invisible twin: sizes the masked box to the words. */}
      <Stack opacity={0} onLayout={handleTextLayout}>
        <SizableText size="$headingMd">{children}</SizableText>
      </Stack>
      {/* The resting ink: the theme's own subdued text color; the band
          brightens it as it passes. */}
      <Stack
        position="absolute"
        top={0}
        left={0}
        right={0}
        bottom={0}
        backgroundColor="$textSubdued"
      />
      <AnimatedLinearGradient
        colors={BAND_COLORS}
        start={GRADIENT_START}
        end={GRADIENT_END}
        style={bandStyle}
      />
    </MaskedView>
  );
}
