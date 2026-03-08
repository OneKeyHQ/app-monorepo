import { Linking } from 'react-native';

import { ReactNativeDeviceUtils } from '@onekeyfe/react-native-device-utils';

import type { IWebViewChecker } from './type';

export const getCurrentWebViewPackageInfo: IWebViewChecker['getCurrentWebViewPackageInfo'] =
  () => ReactNativeDeviceUtils.getCurrentWebViewPackageInfo();

export const isGooglePlayServicesAvailable: IWebViewChecker['isGooglePlayServicesAvailable'] =
  () => ReactNativeDeviceUtils.isGooglePlayServicesAvailable();

export const openWebViewInGooglePlay = () => {
  void Linking.openURL(
    'https://play.google.com/store/apps/details?id=com.google.android.webview',
  );
};
