import { memo, useEffect } from 'react';

import { StyleSheet } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';

import { Icon, Stack } from '@onekeyhq/components';
import { HardwareDevice } from '@onekeyhq/components/src/content/HardwareDevice';

import type { IDeviceType } from '@onekeyfe/hd-core';

/** Rendered width of the replica; height follows each model's aspect ratio. */
const DEVICE_WIDTH = 100;

const styles = StyleSheet.create({
  badge: {
    position: 'absolute',
    top: -10,
    right: -10,
  },
});

const BADGE_ENTRY_SCALE = 0.6;
/** Lands with a faint overshoot. */
const BADGE_SPRING = { damping: 11, stiffness: 240, mass: 0.7 } as const;

/** Success badge: pops in on mount, settling with a slight bounce. */
function DoneBadge() {
  const reducedMotion = useReducedMotion();
  const progress = useSharedValue(reducedMotion ? 1 : 0);
  useEffect(() => {
    progress.value = reducedMotion ? 1 : withSpring(1, BADGE_SPRING);
  }, [progress, reducedMotion]);
  const badgeStyle = useAnimatedStyle(
    () => ({
      // Fully opaque well before the spring settles, so only the scale bounces.
      opacity: Math.min(1, progress.value * 2),
      transform: [
        {
          scale: BADGE_ENTRY_SCALE + (1 - BADGE_ENTRY_SCALE) * progress.value,
        },
      ],
    }),
    [progress],
  );
  return (
    <Animated.View style={[styles.badge, badgeStyle]}>
      <Stack
        borderRadius="$full"
        bg="$bgApp"
        p="$0.5"
        testID="firmware-update-done-badge"
      >
        <Icon name="CheckRadioSolid" color="$brand9" size="$8" />
      </Stack>
    </Animated.View>
  );
}

/**
 * The code-drawn device replica from Device Stage, on its connecting screen.
 * Memoized: the install view re-renders on every progress tick.
 */
export const FirmwareUpdateDeviceImage = memo(
  function FirmwareUpdateDeviceImage({
    deviceType,
    done,
  }: {
    deviceType: IDeviceType | undefined;
    /** Shows the success badge; it pops in when this turns true. */
    done?: boolean;
  }) {
    return (
      <Stack testID="firmware-update-device-image">
        <HardwareDevice
          deviceType={deviceType}
          width={DEVICE_WIDTH}
          animation="connecting"
          shadow
        />
        {done ? <DoneBadge /> : null}
      </Stack>
    );
  },
);
