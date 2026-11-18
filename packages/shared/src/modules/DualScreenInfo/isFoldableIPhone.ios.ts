import { ReactNativeDeviceUtils } from '@onekeyfe/react-native-device-utils';
import { isDevice, modelId } from 'expo-device';

import platformEnv from '../../platformEnv';

// The native detector in device-utils 0.56 treats any non-nil UIHinge as a
// fold. iOS 27.3 beta reports a hinge with `unknown` status on regular
// iPhones, so on hardware only known foldable model identifiers count until
// the native fix ships. Simulators report the host architecture as `modelId`,
// so they keep the native answer.
const FOLDABLE_IPHONE_MODEL_IDS = new Set(['iPhone19,4']); // iPhone Duo

export const isFoldableIPhone = () => {
  if (platformEnv.isNativeIOSPad) return false;
  if (isDevice) return FOLDABLE_IPHONE_MODEL_IDS.has(modelId ?? '');
  return ReactNativeDeviceUtils.isDualScreenDevice();
};
