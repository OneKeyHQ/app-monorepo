import { useEffect, useMemo } from 'react';

import { StyleSheet } from 'react-native';
import Animated, {
  cancelAnimation,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

import { easeOutFn } from '../../content/deviceScene';
import { Icon, Stack } from '../../primitives';

import type { TextStyle } from 'react-native';

/**
 * The waiting capsule's Bluetooth badge (connecting and processing
 * alike). Desktop runs USB and Bluetooth side by side, and the two
 * waits look different by design: the wired one keeps the standing
 * replica in the capsule's device seat — the plugged-in device itself —
 * while the wireless one wears this badge instead, one glance for the
 * person and one screenshot for support. Its ripple rings are
 * absolutely positioned over the same box, so the pulse never moves
 * layout.
 */

/** The badge fills the capsule's device seat (CAPSULE_ROW.thumbBox). */
const BADGE_SIZE = 40;
/** The design's channel blue — a committed ink, like the stage's other
 * own colors. */
const BADGE_BG = '#3378F6';
/** A ring's full spread: badge edge to the design's 58pt halo edge. */
const RIPPLE_SCALE = 58 / BADGE_SIZE;
const RIPPLE_MS = 1800;
/** Two rings, half a period apart, keep the pulse continuous. */
const RIPPLE_STAGGER_MS = RIPPLE_MS / 2;

/** White on the committed blue, whatever the theme says — Icon reads its
 * ink and size off `style` first, so no theme token is in the loop. */
const ICON_STYLE: TextStyle = { color: '#FFFFFF', width: 24, height: 24 };

const styles = StyleSheet.create({
  // Badge-sized and badge-positioned: at rest a ring hides entirely
  // under the badge circle drawn above it, so pausing needs no second
  // rest state.
  ring: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: BADGE_SIZE,
    height: BADGE_SIZE,
    borderRadius: BADGE_SIZE / 2,
    backgroundColor: 'rgba(51,120,246,0.4)',
  },
});

function RippleRing({ delayMs, paused }: { delayMs: number; paused: boolean }) {
  const progress = useSharedValue(0);
  useEffect(() => {
    if (paused) {
      cancelAnimation(progress);
      progress.value = 0;
      return undefined;
    }
    progress.value = 0;
    progress.value = withDelay(
      delayMs,
      withRepeat(
        withTiming(1, { duration: RIPPLE_MS, easing: easeOutFn }),
        -1,
        false,
      ),
    );
    return () => cancelAnimation(progress);
  }, [delayMs, paused, progress]);
  const motionStyle = useAnimatedStyle(
    () => ({
      opacity: 1 - progress.value,
      transform: [{ scale: 1 + progress.value * (RIPPLE_SCALE - 1) }],
    }),
    [progress],
  );
  const ringStyle = useMemo(() => [styles.ring, motionStyle], [motionStyle]);
  return <Animated.View pointerEvents="none" style={ringStyle} />;
}

export function BluetoothBadge({
  paused,
}: {
  /** Rings rest while the capsule is off show: the ripple is a waiting
   * affordance and parked seats pay no frames. */
  paused: boolean;
}) {
  // Under reduced motion the badge stands still — the channel reads off
  // the icon alone.
  const reducedMotion = useReducedMotion();
  const rippleResting = paused || reducedMotion;
  return (
    <Stack
      testID="device-stage-bluetooth-badge"
      width={BADGE_SIZE}
      height={BADGE_SIZE}
      alignItems="center"
      justifyContent="center"
    >
      <RippleRing delayMs={0} paused={rippleResting} />
      <RippleRing delayMs={RIPPLE_STAGGER_MS} paused={rippleResting} />
      <Stack
        width={BADGE_SIZE}
        height={BADGE_SIZE}
        borderRadius="$full"
        bg={BADGE_BG}
        alignItems="center"
        justifyContent="center"
      >
        <Icon name="BluetoothSolid" style={ICON_STYLE} />
      </Stack>
    </Stack>
  );
}
