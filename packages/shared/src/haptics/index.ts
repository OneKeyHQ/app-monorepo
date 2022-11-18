import * as Haptics from 'expo-haptics';

import platformEnv from '../platformEnv';

const isNativeIPhoneOnly =
  platformEnv.isNativeIOS && !platformEnv.isNativeIOSPad;

/** only support on iphone or android(tablet), not include ipad */
export const supportedHaptics =
  isNativeIPhoneOnly || platformEnv.isNativeAndroid;

/** native ios default is true, native android default is false */
export const defaultHapticStatus = !!(isNativeIPhoneOnly && supportedHaptics);

export const enableHaptics = supportedHaptics
  ? Haptics.selectionAsync
  : () => {};
