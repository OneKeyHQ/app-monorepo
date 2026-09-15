import { useEffect } from 'react';

import { StyleSheet, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import { Icon, Stack } from '@onekeyhq/components';
import { HardwareDevice } from '@onekeyhq/components/src/content/HardwareDevice';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import type { IDeviceType } from '@onekeyfe/hd-core';

/** Rendered width of the replica; height follows each model's aspect ratio. */
const DEVICE_WIDTH = 100;

const SHADOW_OPACITY = 0.35;
const SHADOW_BLUR = 10;
const SHADOW_DROP = 8;

/**
 * Soft drop shadow under the replica, standing in for the design's blurred
 * copy. Both forms follow the drawn silhouette rather than the frame: the
 * frame is wider than the body (the side button sits inside it, and each
 * model's chrome differs), so a box shadow would spill past the shell.
 */
const styles = StyleSheet.create({
  shadow: platformEnv.isNative
    ? {
        shadowColor: '#000000',
        shadowOpacity: SHADOW_OPACITY,
        shadowRadius: SHADOW_BLUR,
        shadowOffset: { width: 0, height: SHADOW_DROP },
      }
    : {
        filter: `drop-shadow(0 ${SHADOW_DROP}px ${SHADOW_BLUR}px rgba(0,0,0,${SHADOW_OPACITY}))`,
      },
  badge: {
    position: 'absolute',
    top: -10,
    right: -10,
  },
});

const BADGE_ENTRY_SCALE = 0.6;
/** Lands with a faint overshoot. */
const BADGE_SPRING = { damping: 11, stiffness: 240, mass: 0.7 } as const;
const BADGE_FADE_MS = 180;

/** Success badge: pops in on mount, settling with a slight bounce. */
function DoneBadge() {
  const reducedMotion = useReducedMotion();
  const progress = useSharedValue(reducedMotion ? 1 : 0);
  useEffect(() => {
    if (reducedMotion) {
      progress.value = 1;
      return;
    }
    progress.value = withSpring(1, BADGE_SPRING);
  }, [progress, reducedMotion]);
  const opacity = useSharedValue(reducedMotion ? 1 : 0);
  useEffect(() => {
    opacity.value = reducedMotion
      ? 1
      : withTiming(1, { duration: BADGE_FADE_MS });
  }, [opacity, reducedMotion]);
  const badgeStyle = useAnimatedStyle(
    () => ({
      opacity: opacity.value,
      transform: [
        {
          scale: BADGE_ENTRY_SCALE + (1 - BADGE_ENTRY_SCALE) * progress.value,
        },
      ],
    }),
    [opacity, progress],
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

/** The code-drawn device replica from Device Stage, on its connecting screen. */
export function FirmwareUpdateDeviceImage({
  deviceType,
  done,
}: {
  deviceType: IDeviceType | undefined;
  /** Shows the success badge; it pops in when this turns true. */
  done?: boolean;
}) {
  return (
    <Stack testID="firmware-update-device-image">
      <View style={styles.shadow}>
        <HardwareDevice
          deviceType={deviceType}
          width={DEVICE_WIDTH}
          animation="connecting"
        />
      </View>
      {done ? <DoneBadge /> : null}
    </Stack>
  );
}
