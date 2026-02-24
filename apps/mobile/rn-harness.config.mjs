import {
  applePlatform,
  appleSimulator,
} from '@react-native-harness/platform-apple';
import {
  androidEmulator,
  androidPlatform,
} from '@react-native-harness/platform-android';

// Override defaults via environment variables:
//   HARNESS_IOS_DEVICE   - iOS simulator name (default: 'iPhone 17 Pro')
//   HARNESS_IOS_VERSION  - iOS version (default: '26.2')
//   HARNESS_ANDROID_AVD  - Android AVD name (default: 'test_avd')
//   HARNESS_ANDROID_API  - Android API level (default: 35)
const iosDevice = process.env.HARNESS_IOS_DEVICE || 'iPhone 17 Pro';
const iosVersion = process.env.HARNESS_IOS_VERSION || '26.2';
const androidAvd = process.env.HARNESS_ANDROID_AVD || 'test_avd';
const androidApi = Number(process.env.HARNESS_ANDROID_API) || 35;

/** @type {import('react-native-harness').Config} */
const config = {
  entryPoint: './index.ts',
  appRegistryComponentName: 'main',
  runners: [
    applePlatform({
      name: 'ios',
      device: appleSimulator(iosDevice, iosVersion),
      bundleId: 'so.onekey.wallet',
    }),
    androidPlatform({
      name: 'android',
      device: androidEmulator(androidAvd, {
        apiLevel: androidApi,
        profile: 'pixel_7',
      }),
      bundleId: 'so.onekey.app.wallet',
    }),
  ],
  defaultRunner: 'ios',
  forwardClientLogs: true,
};

export default config;
