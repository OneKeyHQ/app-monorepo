import { Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Icon, Stack, useThemeName } from '@onekeyhq/components';

const LOGO_WIDTH = 70;
const LOGO_HEIGHT = 22;

// Device thresholds based on insets.top values
// iPhone X/XS/11 Pro: 44pt, iPhone 12/13/14: 47pt, Dynamic Island: 59-68pt
const NOTCH_THRESHOLD = 44; // Notch devices: insets.top >= 44
const DYNAMIC_ISLAND_THRESHOLD = 55; // Dynamic Island: insets.top 55-65
const DYNAMIC_ISLAND_AIR_THRESHOLD = 65; // iPhone 17 Air: insets.top >= 65

const getLogoTop = (insetsTop: number): number => {
  // iPhone 17 Air (insets.top >= 65)
  if (insetsTop >= DYNAMIC_ISLAND_AIR_THRESHOLD) {
    return 20;
  }
  // Dynamic Island iPhone 14 Pro - 17 Pro (insets.top 55-65)
  if (insetsTop >= DYNAMIC_ISLAND_THRESHOLD) {
    return 14;
  }
  // Notch devices (insets.top 44-55)
  return 7;
};

export function ScreenshotBranding() {
  const insets = useSafeAreaInsets();
  const themeName = useThemeName();

  // Only render on iOS Notch & Dynamic Island devices (insets.top >= 44)
  const isNotchOrDynamicIsland =
    Platform.OS === 'ios' && insets.top >= NOTCH_THRESHOLD;

  if (!isNotchOrDynamicIsland) {
    return null;
  }

  const iconName =
    themeName === 'dark'
      ? 'OnekeyBrandingPillDarkIllus'
      : 'OnekeyBrandingPillIllus';

  return (
    <Stack
      pointerEvents="none"
      position="absolute"
      top={getLogoTop(insets.top)}
      left={0}
      right={0}
      alignItems="center"
      zIndex={9999}
    >
      <Icon name={iconName} width={LOGO_WIDTH} height={LOGO_HEIGHT} />
    </Stack>
  );
}
