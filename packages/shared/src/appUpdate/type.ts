import type { ILocaleSymbol } from '../locale';

export interface IIOS {
  url: string;
  version: number[];
  miniVersion?: number[];
  minVersion?: number[];
}

export interface IChannelInfo {
  url: string;
  version: number[];
}

export interface IAndroid extends IChannelInfo {
  googlePlay: string;
  miniVersion?: number[];
  minVersion?: number[];
  google: IChannelInfo;
  huawei: IChannelInfo;
}

export interface IExt {
  chrome: string;
  firefox: string;
  edge: string;
  miniVersion?: number[];
  minVersion?: number[];
}

export type IChangeLog = Record<ILocaleSymbol, string>;

export interface IDesktop {
  sha256sumAsc: string;
  version: number[];
  miniVersion?: number[];
  minVersion?: number[];
  linux: string;
  macX64: string;
  macARM: string;
  win: string;
  changelog: IChangeLog[];
  mas: string;
  msStore: string;
  snapStore: string;
}

export interface IPackageChangelog {
  version: string;
  locale: IChangeLog;
}

export interface IAppUpdateInfoData {
  ios: IIOS;
  android: IAndroid;
  ext: IExt;
  desktop: IDesktop;
  changelog: IPackageChangelog[];
}

export interface IBasicAppUpdateInfo {
  // the latest version of remote server
  latestVersion?: string;
  // app store url
  storeUrl?: string;
  // app download url
  downloadUrl?: string;
  // is force update required
  isForceUpdate: boolean;
  // change log text
  changeLog?: IChangeLog;
}

export interface IAppUpdateInfo extends IBasicAppUpdateInfo {
  // current version
  version: string;
  // the last time the app update info was fetched
  updateAt: number;
  // App from app Store
  //  notify -> done
  // App from outside channels
  //  1. notify -> downloading -> ready -> done
  //  2. notify -> failed
  status: EAppUpdateStatus;
}

export enum EAppUpdateStatus {
  notify = 'notify',
  downloading = 'downloading',
  ready = 'ready',
  failed = 'failed',
  done = 'done',
}

export type IHandleReleaseInfo = (
  releaseInfo: IAppUpdateInfoData,
) => IBasicAppUpdateInfo;
