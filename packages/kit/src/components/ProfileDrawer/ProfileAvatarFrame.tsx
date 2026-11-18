import type { ReactNode } from 'react';

import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { Stack } from '@onekeyhq/components';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { openProfileDrawer, profileDrawerProgress } from './profileDrawerStore';

export const PROFILE_AVATAR_TEST_ID = 'home-profile-avatar';

const FOCUS_RING = {
  outlineColor: '$focusRing',
  outlineStyle: 'solid',
  outlineWidth: 2,
} as const;
// A pointer dims the avatar it is over, as the drawer's avatar does.
const HOVER_STYLE = platformEnv.isNative ? undefined : { opacity: 0.8 };

// The phone draws a 40 avatar for the finger. The extension's pointer needs
// less, and at 32 the avatar no longer outweighs the bare search and network
// controls across the header.
export const PROFILE_AVATAR_SIZE = platformEnv.isNative ? '$10' : '$8';
// The target keeps 2 around the avatar, room for the focus ring.
const FRAME_SIZE = platformEnv.isNative ? 44 : 36;
const DOT_SIZE = platformEnv.isNative ? 14 : 12;

export function ProfileAvatarFrame({
  label,
  dot,
  children,
}: {
  label: string;
  dot?: boolean;
  children: ReactNode;
}) {
  const pressed = useSharedValue(0);
  // Fades out as the drawer opens, handing over to the drawer's avatar;
  // a 0.97 press is felt rather than seen.
  const style = useAnimatedStyle(() => ({
    opacity: 1 - profileDrawerProgress.value,
    transform: [{ scale: 1 - 0.03 * pressed.value }],
  }));
  return (
    <Animated.View style={style}>
      <Stack
        testID={PROFILE_AVATAR_TEST_ID}
        // A real button on web: Tab focus, Enter and Space, and a target the
        // drawer hands focus back to when it closes.
        render={<button type="button" aria-label={label} />}
        role="button"
        aria-label={label}
        focusVisibleStyle={FOCUS_RING}
        hoverStyle={HOVER_STYLE}
        bg="$transparent"
        borderWidth={0}
        w={FRAME_SIZE}
        h={FRAME_SIZE}
        ml="$-0.5"
        p="$0.5"
        borderRadius="$full"
        onPressIn={() => {
          pressed.value = withTiming(1, { duration: 100 });
        }}
        onPressOut={() => {
          pressed.value = withTiming(0, { duration: 150 });
        }}
        onPress={openProfileDrawer}
      >
        {children}
        {dot ? (
          <Stack
            position="absolute"
            top={1}
            right={1}
            w={DOT_SIZE}
            h={DOT_SIZE}
            borderRadius="$full"
            borderWidth={2}
            borderColor="$bgApp"
            bg="$bgCriticalStrong"
            pointerEvents="none"
          />
        ) : null}
      </Stack>
    </Animated.View>
  );
}
