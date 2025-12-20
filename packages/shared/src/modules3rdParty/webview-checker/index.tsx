import type { IWebViewChecker } from './type';

export const getCurrentWebViewPackageInfo: IWebViewChecker['getCurrentWebViewPackageInfo'] =
  () => Promise.resolve(undefined);

export const isGooglePlayServicesAvailable: IWebViewChecker['isGooglePlayServicesAvailable'] =
  () =>
    Promise.resolve({
      isAvailable: false,
      status: 0,
      statusMessage: '',
    });

export const openWebViewInGooglePlay = () => {};
