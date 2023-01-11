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
};
