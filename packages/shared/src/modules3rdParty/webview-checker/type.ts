
export interface IWebViewPackageInfo {
  packageName: string;
  versionName: string;
  versionCode: number;
}

export interface IGooglePlayServicesStatus {
  status: number;
  isAvailable: boolean;
  statusMessage: string;
}

export interface IWebViewChecker {
  getCurrentWebViewPackageInfo: () => Promise<IWebViewPackageInfo | undefined>;
  isGooglePlayServicesAvailable: () => Promise<IGooglePlayServicesStatus>;
}
