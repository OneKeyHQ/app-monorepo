import { ReactNativeDeviceUtils } from '@onekeyfe/react-native-device-utils';

import platformEnv from '../../platformEnv';

export const isFoldableIPhone = () =>
  !platformEnv.isNativeIOSPad && ReactNativeDeviceUtils.isDualScreenDevice();
