import type { ETranslations } from '../locale';
import type { IUpdateDownloadedEvent } from '../modules3rdParty/auto-update';

export enum EUpdateStrategy {
  // Download and install silently in the background; only show UI when ready to install.
  silent = 0,
  // Block the user until update is applied. Shows a full-screen modal that cannot be dismissed.
  force = 1,
  // Show update notification to the user; download and install only after user confirms.
  manual = 2,
  // Fully transparent to the user — download, verify, and install without any UI.
  seamless = 3,
}

export enum EUpdateFileType {
  appShell = 1,
  jsBundle = 2,
}

export type IUpdateDecision =
  | 'none'
  | 'appShellUpdate'
  | 'jsBundleUpgrade'
  | 'jsBundleRollback'
  | 'jsBundleRollbackToBuiltin'
  | 'staleRemote'
  | 'invalidLocal'
  | 'invalidRemote';

export enum EPendingInstallTaskType {
  jsBundleSwitch = 'jsbundle-switch',
  appInstall = 'app-install',
}

export enum EPendingInstallTaskAction {
  switchBundle = 'switch-bundle',
  installApp = 'install-app',
}

export enum EPendingInstallTaskStatus {
  pending = 'pending',
  running = 'running',
  appliedWaitingVerify = 'applied_waiting_verify',
  failed = 'failed',
}

export interface IJsBundleSwitchTaskPayload {
  appVersion: string;
  bundleVersion: string;
  signature: string;
}

export interface IAppUpdateInstallTaskPayload {
  latestVersion: string;
  updateStrategy: EUpdateStrategy;
  channel: 'store' | 'direct';
  storeUrl?: string;
  downloadUrl?: string;
  fileSize?: number;
  sha256?: string;
  signature?: string;
}

export interface IPendingInstallTaskBase {
  taskId: string;
  revision: number;
  action: EPendingInstallTaskAction;
  type: EPendingInstallTaskType;
  targetAppVersion: string;
  targetBundleVersion: string;
  /** Native app version (e.g. CFBundleShortVersionString / versionName) at the time the task was scheduled */
  scheduledEnvAppVersion: string;
  scheduledEnvBundleVersion: string;
  /** Native build number (e.g. CFBundleVersion / versionCode) at the time the task was scheduled */
  scheduledEnvBuildNumber?: string;
  createdAt: number;
  expiresAt: number;
  retryCount: number;
  status: EPendingInstallTaskStatus;
  runningStartedAt?: number;
  nextRetryAt?: number;
  lastError?: string;
}

export type IPendingInstallTask =
  | (IPendingInstallTaskBase & {
      action: EPendingInstallTaskAction.switchBundle;
      type: EPendingInstallTaskType.jsBundleSwitch;
      payload: IJsBundleSwitchTaskPayload;
    })
  | (IPendingInstallTaskBase & {
      action: EPendingInstallTaskAction.installApp;
      type: EPendingInstallTaskType.appInstall;
      payload: IAppUpdateInstallTaskPayload;
    });

export interface IResolvedUpdateDecision {
  decision: IUpdateDecision;
  // true when decision input payload was semantically valid
  isValid: boolean;
  reason: string;
}

export interface IIgnoredUpdateTargetInfo {
  reason: string;
  createdAt: number;
  expiresAt: number;
}

export interface IFullFlowRetryInfo {
  count: number;
  updatedAt: number;
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
  // Number of hot-update (jsBundle) records for this version in the server DB.
  // When 0, the server has no bundle configured — client should rollback to
  // builtin if it has an active custom bundle.
  // When > 0 and jsBundleVersion is absent, the client is already up to date.
  jsBundleCount?: number;
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
  // true when the pending update target is a rollback (target bundle < current bundle)
  isRollbackTarget?: boolean;
  freezeUntil?: number;
  ignoredTargets?: Record<string, IIgnoredUpdateTargetInfo>;
  fullFlowRetryByTarget?: Record<string, IFullFlowRetryInfo>;
  lastRequestSeq?: number;
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
