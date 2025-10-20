import { NativeModules } from 'react-native';

let channel = 'direct';

if (NativeModules.BundleUpdateModule) {
  const constants = (
    NativeModules.BundleUpdateModule as {
      getConstants: () => { ANDROID_CHANNEL: string };
    }
  )?.getConstants();
  if (constants.ANDROID_CHANNEL) {
    channel = constants.ANDROID_CHANNEL;
  }
}

export const ANDROID_CHANNEL = channel;
