import type { LocaleSymbol } from '@onekeyhq/components/src/locale';

export interface IOS {
  url: string;
  version: number[];
  miniVersion?: number[];
  minVersion?: number[];
}

export interface ChannelInfo {
  url: string;
  version: number[];
}

export interface Android extends ChannelInfo {
  googlePlay: string;
  miniVersion?: number[];
  minVersion?: number[];
  google: ChannelInfo;
  huawei: ChannelInfo;
}

export interface Ext {
  chrome: string;
  firefox: string;
  edge: string;
  miniVersion?: number[];
  minVersion?: number[];
}

export type Changelog = Record<LocaleSymbol, string>;

export interface Desktop {
  sha256sumAsc: string;
  version: number[];
  miniVersion?: number[];
  minVersion?: number[];
  linux: string;
  macX64: string;
  macARM: string;
  win: string;
  changelog: Changelog;
  mas: ChannelInfo;
  msStore: ChannelInfo;
  snapStore: ChannelInfo;
}

export interface AppReleases {
  web: {
    miniVersion?: number[];
    minVersion?: number[];
  };
  ios: IOS;
  android: Android;
  ext: Ext;
  desktop: Desktop;
  changelog: PackageChangelog[];
}

export interface PackageChangelog {
  version: string;
  locale: Changelog;
}
