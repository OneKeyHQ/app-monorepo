import {
  applePlatform,
  appleSimulator,
} from '@react-native-harness/platform-apple';

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
  ],
  defaultRunner: 'ios',
  forwardClientLogs: true,
};

export default config;
