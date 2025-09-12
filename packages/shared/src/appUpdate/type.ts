import type { ETranslations } from '../locale';
import type { IUpdateDownloadedEvent } from '../modules3rdParty/auto-update';

export interface IBasicAppUpdateInfo {
  // app store url
  storeUrl?: string;
  // app download url
  downloadUrl?: string;
  // is force update required
  isForceUpdate: boolean;
  // change log text
  changeLog?: string;
  summary?: string;
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
  isShowUpdateDialog?: boolean;
  summary?: string;
}

export enum EAppUpdateStatus {
  notify = 'notify',
  downloadPackage = 'downloadPackage',
  downloadPackageFailed = 'downloadPackageFailed',
  downloadASC = 'downloadASC',
  downloadASCFailed = 'downloadASCFailed',
  verifyASC = 'verifyASC',
  verifyASCFailed = 'verifyASCFailed',
  verifyPackage = 'verifyPackage',
  verifyPackageFailed = 'verifyPackageFailed',
  ready = 'ready',
  failed = 'failed',
  done = 'done',
  manualInstall = 'manualInstall',
  updateIncomplete = 'updateIncomplete',
}
