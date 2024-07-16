import type { ETranslations } from '../locale';
import { IUpdateDownloadedEvent } from '../modules3rdParty/auto-update';

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
  downloadedEvent?: IUpdateDownloadedEvent;
}

export enum EAppUpdateStatus {
  notify = 'notify',
  downloading = 'downloading',
  verifying = 'verifying',
  ready = 'ready',
  failed = 'failed',
  done = 'done',
}
