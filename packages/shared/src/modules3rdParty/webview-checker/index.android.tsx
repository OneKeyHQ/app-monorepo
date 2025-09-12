import { Linking, NativeModules } from 'react-native';

import type { IWebViewChecker } from './type';

const { WebViewCheckerModule } = NativeModules as {
  WebViewCheckerModule: IWebViewChecker;
};

export const getCurrentWebViewPackageInfo: IWebViewChecker['getCurrentWebViewPackageInfo'] =
  () => WebViewCheckerModule.getCurrentWebViewPackageInfo();

export const isGooglePlayServicesAvailable: IWebViewChecker['isGooglePlayServicesAvailable'] =
  () => WebViewCheckerModule.isGooglePlayServicesAvailable();

export const openWebViewInGooglePlay = () => {
  void Linking.openURL(
    'https://play.google.com/store/apps/details?id=com.google.android.webview',
  );
};
