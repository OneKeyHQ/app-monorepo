export type OS =
  | 'ios'
  | 'android'
  | 'win'
  | 'macos-x64'
  | 'macos-arm64'
  | 'linux'
  | 'firefox'
  | 'chrome'
  | 'edge';

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
  version: string;
  forceVersion: string;
}

export interface PackagesInfo {
  ios: PackageInfo[];
  android: PackageInfo[];
  desktop: PackageInfo[];
  extension: PackageInfo[];
}

export interface ReleasesInfo {
  packages: PackagesInfo | undefined;
}

export interface VersionInfo {
  package: PackageInfo;
}
