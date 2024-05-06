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
  changeLog?: string;
  // sha256 for downloaded package
  sha256?: string;
}

export interface IAppUpdateInfo extends IBasicAppUpdateInfo {
  // the last time the app update info was fetched
  updateAt: number;
  // App from app Store
  //  notify -> done
  // App from outside channels
  //  1. notify -> downloading -> ready -> done
  //  2. notify -> failed
  status: EAppUpdateStatus;
  errorText?: string;
}

export enum EAppUpdateStatus {
  notify = 'notify',
  downloading = 'downloading',
  ready = 'ready',
  failed = 'failed',
  done = 'done',
}
