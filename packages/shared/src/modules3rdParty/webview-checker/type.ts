export interface IWebViewPackageInfo {
  packageName: string;
  versionName: string;
  versionCode: number;
}

export interface IGooglePlayServicesStatus {
  status: number;
  isAvailable: boolean;
}

export interface IWebViewChecker {
  getCurrentWebViewPackageInfo: () => Promise<IWebViewPackageInfo | undefined>;
  isGooglePlayServicesAvailable: () => Promise<IGooglePlayServicesStatus>;
}
