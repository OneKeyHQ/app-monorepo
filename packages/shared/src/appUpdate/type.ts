import type { ETranslations } from '../locale';

export interface IBasicAppUpdateInfo {
  // app store url
  storeUrl?: string;
  // app download url
  downloadUrl?: string;
  // is force update required
  isForceUpdate: boolean;
  // change log text
  changeLog?: string;
  // sha256 for downloaded package
  sha256?: string;
}

export interface IResponseAppUpdateInfo extends IBasicAppUpdateInfo {
  version?: string;
}

export interface IAppUpdateInfo extends IBasicAppUpdateInfo {
  // the latest version of remote server
  latestVersion?: string;
  // the last time the app update info was fetched
  updateAt: number;
  // App from app Store
  //  notify -> done
  // App from outside channels
  //  1. notify -> downloading -> ready -> done
  //  2. notify -> failed
  status: EAppUpdateStatus;
  errorText?: ETranslations;
}

export enum EAppUpdateStatus {
  notify = 'notify',
  downloading = 'downloading',
  ready = 'ready',
  failed = 'failed',
  done = 'done',
}
