import {
  applePlatform,
  appleSimulator,
} from '@react-native-harness/platform-apple';
import {
  androidPlatform,
  androidEmulator,
} from '@react-native-harness/platform-android';

/** @type {import('react-native-harness').Config} */
const config = {
  entryPoint: './index.ts',
  appRegistryComponentName: 'main',
  runners: [
    applePlatform({
      name: 'ios',
      device: appleSimulator('iPhone 17 Pro', '26.2'),
      bundleId: 'so.onekey.wallet',
    }),
    androidPlatform({
      name: 'android',
      device: androidEmulator('Pixel_7_API_35', {
        apiLevel: 35,
        profile: 'pixel_7',
      }),
      bundleId: 'so.onekey.app.wallet',
    }),
  ],
  defaultRunner: 'ios',
  forwardClientLogs: true,
};

export default config;
