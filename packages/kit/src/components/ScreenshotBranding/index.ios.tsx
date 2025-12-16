import { Platform, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Icon } from '@onekeyhq/components';

import { useThemeVariant } from '../../hooks/useThemeVariant';

const LOGO_TOP = 14;
const LOGO_WIDTH = 58;
const LOGO_HEIGHT = 16;
const NOTCH_THRESHOLD = 44; // Notch & Dynamic Island devices have insets.top >= 47

export function ScreenshotBranding() {
  const insets = useSafeAreaInsets();
  const themeVariant = useThemeVariant();

  // Only render on iOS Notch & Dynamic Island devices (insets.top > 44)
  const isNotchDevice = Platform.OS === 'ios' && insets.top > NOTCH_THRESHOLD;

  if (!isNotchDevice) {
    return null;
  }

  return (
    <View
      pointerEvents="none"
      style={{
        position: 'absolute',
        top: LOGO_TOP,
        left: 0,
        right: 0,
        alignItems: 'center',
        zIndex: 9999,
      }}
    >
      <Icon
        name="OnekeyTextIllus"
        width={LOGO_WIDTH}
        height={LOGO_HEIGHT}
        style={{ color: themeVariant === 'light' ? '#000000' : '#FFFFFF' }}
      />
    </View>
  );
}
