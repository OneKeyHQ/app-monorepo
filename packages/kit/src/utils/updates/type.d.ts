export type OS =
  | 'ios'
  | 'android'
  | 'win'
  | 'macos-x64'
  | 'macos-arm64'
  | 'linux'
  | 'firefox'
  | 'chrome';

export type Channel =
  | 'AppStore'
  | 'GooglePlay'
  | 'ChromeWebStore'
  | 'MozillaAddOns'
  | 'Direct';

export interface PackageInfo {
  os: OS;
  channel: Channel;
  download: string;
}

export interface PackagesInfo {
  ios: PackageInfo[];
  android: PackageInfo[];
  desktop: PackageInfo[];
  extension: PackageInfo[];
}

export interface ReleasesInfo {
  version: string;
  forceVersion: string;
  buildNumber: string;
  changeLog: string;
  packages: PackagesInfo | undefined;
}

export interface VersionInfo {
  version: string;
  forceVersion: string;
  buildNumber: string;
  changeLog: string;
  package: PackageInfo;
}
