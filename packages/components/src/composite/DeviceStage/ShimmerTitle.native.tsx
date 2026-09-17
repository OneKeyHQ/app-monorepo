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

import { useTheme } from '../../hooks/useStyle';
import { SizableText, Stack } from '../../primitives';

import type { ISizableTextProps } from '../../primitives';
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
const WHITE_BAND = '#FFFFFF';

/**
 * The band's edges must fade to the band's own color at alpha 0: fading to
 * plain `transparent` (black at alpha 0) greys the ramp on iOS. Theme
 * colors here are 6- or 8-digit hex; anything else falls back.
 */
function bandEdge(color: string) {
  const hex = /^#([0-9a-f]{6})(?:[0-9a-f]{2})?$/i.exec(color);
  return hex ? `#${hex[1]}00` : 'transparent';
}

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
  size = '$headingMd',
  band = 'white',
}: {
  children: string;
  /** The sweep stands down (band parked off the words) while the title
   * is mounted but hidden; clearing it restarts the sweep from the left. */
  paused?: boolean;
  /** Text size; the capsule's heading by default. */
  size?: ISizableTextProps['size'];
  /**
   * The bright band: plain white (the capsule's look) or the theme's
   * text color, for titles that sit on the page surface.
   */
  band?: 'white' | 'text';
}) {
  const reducedMotion = useReducedMotion();
  const theme = useTheme();
  const bandColor = band === 'text' ? theme.text.val : WHITE_BAND;
  const bandColors = useMemo(
    () => [bandEdge(bandColor), bandColor, bandEdge(bandColor)] as const,
    [bandColor],
  );
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
    () => <SizableText size={size}>{children}</SizableText>,
    [children, size],
  );
  if (reducedMotion) {
    return (
      <SizableText size={size} color="$textSubdued">
        {children}
      </SizableText>
    );
  }
  return (
    <MaskedView maskElement={maskElement}>
      {/* Invisible twin: sizes the masked box to the words. */}
      <Stack opacity={0} onLayout={handleTextLayout}>
        <SizableText size={size}>{children}</SizableText>
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
        colors={bandColors}
        start={GRADIENT_START}
        end={GRADIENT_END}
        style={bandStyle}
      />
    </MaskedView>
  );
}
