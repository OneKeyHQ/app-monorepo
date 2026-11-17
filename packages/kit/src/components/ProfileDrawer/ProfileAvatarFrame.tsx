import type { ReactNode } from 'react';

import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { Stack } from '@onekeyhq/components';

import { openProfileDrawer, profileDrawerProgress } from './profileDrawerStore';

export const PROFILE_AVATAR_TEST_ID = 'home-profile-avatar';

// 40 avatar in a 44 target, as drawn in the header.
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
        role="button"
        aria-label={label}
        w={44}
        h={44}
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
            w={14}
            h={14}
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
