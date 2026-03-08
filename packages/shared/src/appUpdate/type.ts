import type { ETranslations } from '../locale';
import type { IUpdateDownloadedEvent } from '../modules3rdParty/auto-update';

export enum EUpdateStrategy {
  silent = 0,
  force = 1,
  manual = 2,
  seamless = 3,
}

export enum EUpdateFileType {
  appShell = 1,
  jsBundle = 2,
}

export interface IBasicAppUpdateInfo {
  /* app store url */
  storeUrl?: string;
  /* app download url */
  downloadUrl?: string;
  /* change log text */
  changeLog?: string;

  /**
   *  update strategy
   * @enum EUpdateStrategy
   * 0: silent
   * 1: force
   * 2: manual
   * @default 2
   */
  updateStrategy: EUpdateStrategy;
  summary?: string;
  jsBundleVersion?: string;
  fileSize?: number;
  jsBundle?: {
    downloadUrl?: string;
    fileSize?: number;
    sha256?: string;
    signature?: string;
  };
}

export interface IResponseAppUpdateInfo extends IBasicAppUpdateInfo {
  version?: string;
}

export interface IAppUpdateInfo extends IBasicAppUpdateInfo {
  // the previous app version before update
  previousAppVersion?: string;
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
  summary?: string;
  // the last time the update dialog was shown (for rate limiting)
  lastUpdateDialogShownAt?: number;
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
