import { ReactNativeDeviceUtils } from '@onekeyfe/react-native-device-utils';
import { Platform } from 'react-native';
import { expect, test } from 'react-native-harness';

const testOnAndroid = Platform.OS === 'android' ? test : test.skip;

testOnAndroid(
  'DeviceUtils resolves Apple Ads attribution to undefined on Android',
  async () => {
    const token = await ReactNativeDeviceUtils.getAppleAdsAttributionToken();
    expect(token).toBeUndefined();
  },
);
