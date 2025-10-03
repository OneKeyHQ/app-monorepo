import { NativeModules } from 'react-native';

let channel = 'apk';

if (NativeModules.AutoUpdateModule) {
  const constants = (
    NativeModules.AutoUpdateModule as {
      getConstants: () => { ANDROID_CHANNEL: string };
    }
  )?.getConstants();
  if (constants.ANDROID_CHANNEL) {
    channel = constants.ANDROID_CHANNEL;
  }
}

export const ANDROID_CHANNEL = channel;
