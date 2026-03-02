import { ReactNativeDeviceUtils } from '@onekeyfe/react-native-device-utils';
import { colord } from 'colord';

import platformEnv from '../../platformEnv';

import type { IUpdateRootViewBackgroundColor } from './type';

export const updateRootViewBackgroundColor: IUpdateRootViewBackgroundColor = (
  color: string,
  themeVariant: 'light' | 'dark',
  themeSetting?: 'light' | 'dark' | 'system',
) => {
  const parsedColor = colord(color);
  const { r, g, b, a } = parsedColor.toRgb();
  ReactNativeDeviceUtils.changeBackgroundColor(r, g, b, Math.round(a * 255));

  if (platformEnv.isNativeIOS) {
    // If the user picked "System/Auto", stop overriding iOS UI style so
    // `Appearance.getColorScheme()` reflects the real system setting.
    ReactNativeDeviceUtils.setUserInterfaceStyle(
      themeSetting === 'system' ? 'unspecified' : themeVariant,
    );
  }
};
