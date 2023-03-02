import type { LocaleSymbol } from '@onekeyhq/components/src/locale';

export type OS =
  | 'ios'
  | 'android'
  | 'win'
  | 'macos-x64'
  | 'macos-arm64'
  | 'linux'
  | 'firefox'
  | 'chrome'
  | 'edge'
  | 'mas';

export type Channel =
  | 'AppStore'
  | 'GooglePlay'
  | 'HuaweiAppGallery'
  | 'ChromeWebStore'
  | 'MozillaAddOns'
  | 'MsWindowsStore'
  | 'LinuxSnap'
  | 'Direct';

export interface PackageInfo {
  os: OS;
  channel: Channel;
  download: string;
  version: string;
  forceUpdateVersion?: string;
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
  forceUpdate?: boolean;
}

export interface DesktopVersion {
  version: string;
}

export type Changelog = {
  [key in LocaleSymbol]?: string;
};

export type SYSFirmwareInfo = {
  required: boolean;
  version: number[];
  url: string;
  fingerprint: string;
  changelog: Changelog;
  fullResource?: string;
  fullResourceRange?: string[];
};

export type BLEFirmwareInfo = {
  required: boolean;
  version: number[];
  url: string;
  webUpdate: string;
  fingerprint: string;
  fingerprintWeb: string;
  changelog: Changelog;
};

export type IResourceUpdateInfo = {
  error: string | null;
  needUpdate: boolean;
  minVersion?: string;
  limitVersion?: string;
};
