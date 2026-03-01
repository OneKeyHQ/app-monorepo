import { Linking } from 'react-native';

import { ReactNativeWebviewChecker } from '@onekeyfe/react-native-webview-checker';

import type { IWebViewChecker } from './type';

export const getCurrentWebViewPackageInfo: IWebViewChecker['getCurrentWebViewPackageInfo'] =
  () => ReactNativeWebviewChecker.getCurrentWebViewPackageInfo();

export const isGooglePlayServicesAvailable: IWebViewChecker['isGooglePlayServicesAvailable'] =
  () => ReactNativeWebviewChecker.isGooglePlayServicesAvailable();

export const openWebViewInGooglePlay = () => {
  void Linking.openURL(
    'https://play.google.com/store/apps/details?id=com.google.android.webview',
  );
};
