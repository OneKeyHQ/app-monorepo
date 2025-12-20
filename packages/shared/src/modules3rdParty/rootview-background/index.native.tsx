import { ReactNativeDeviceUtils } from '@onekeyfe/react-native-device-utils';
import { colord } from 'colord';

import type { IUpdateRootViewBackgroundColor } from './type';

export const updateRootViewBackgroundColor: IUpdateRootViewBackgroundColor = (
  color: string,
) => {
  const parsedColor = colord(color);
  const { r, g, b, a } = parsedColor.toRgb();
  ReactNativeDeviceUtils.changeBackgroundColor(r, g, b, Math.round(a * 255));
};
