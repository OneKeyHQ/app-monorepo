import { Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Icon, Stack } from '@onekeyhq/components';

const LOGO_TOP = 14;
const LOGO_WIDTH = 46;
const LOGO_HEIGHT = 16;
const NOTCH_THRESHOLD = 44; // Notch & Dynamic Island devices have insets.top >= 47

export function ScreenshotBranding() {
  const insets = useSafeAreaInsets();

  // Only render on iOS Notch & Dynamic Island devices (insets.top > 44)
  const isNotchDevice = Platform.OS === 'ios' && insets.top > NOTCH_THRESHOLD;

  if (!isNotchDevice) {
    return null;
  }

  return (
    <Stack
      pointerEvents="none"
      position="absolute"
      top={LOGO_TOP}
      left={0}
      right={0}
      alignItems="center"
      zIndex={9999}
    >
      <Icon
        name="OnekeyBrandingPillIllus"
        width={LOGO_WIDTH}
        height={LOGO_HEIGHT}
      />
    </Stack>
  );
}
