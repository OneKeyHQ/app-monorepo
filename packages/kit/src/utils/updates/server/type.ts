import type { LocaleSymbol } from '@onekeyhq/components/src/locale';

export interface IOS {
  url: string;
  version: number[];
}

export interface Android {
  googlePlay: string;
  url: string;
  version: number[];
}

export interface Ext {
  chrome: string;
  firefox: string;
  edge: string;
}

export type Changelog = Record<LocaleSymbol, string>;

export interface Desktop {
  sha256sumAsc: string;
  version: number[];
  linux: string;
  macX64: string;
  macARM: string;
  win: string;
  changelog: Changelog;
}

export interface AppReleases {
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
