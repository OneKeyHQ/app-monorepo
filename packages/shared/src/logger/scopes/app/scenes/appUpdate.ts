import type {
  EUpdateFileType,
  EUpdateStrategy,
  IResponseAppUpdateInfo,
} from '@onekeyhq/shared/src/appUpdate';
import type {
  IDownloadPackageParams,
  IUpdateDownloadedEvent,
} from '@onekeyhq/shared/src/modules3rdParty/auto-update';

import { BaseScene } from '../../../base/baseScene';
import { LogToLocal, LogToServer } from '../../../base/decorators';

export interface ISoftwareUpdateParams {
  // unique ID per update attempt, used to deduplicate retries in Mixpanel
  attemptId: string;
  updateType: 'app' | 'bundle';
  fromVersion: string;
  toVersion: string;
  updateStrategy: string;
  platform: string;
}

export type IAppUpdateAuditPayload = Record<string, unknown>;

/**
 * Software update tracking for Mixpanel analytics.
 *
 * Events: softwareUpdateStarted, softwareUpdateResult
 *
 * Event properties (business):
 *   - attemptId: unique UUID per update attempt (for deduplicating retries)
 *   - updateType: 'app' | 'bundle'
 *   - fromVersion / toVersion: version strings
 *   - updateStrategy: 'silent' | 'force' | 'manual' | 'seamless'
 *   - platform: 'ios' | 'android' | 'desktop' | 'extension' | 'web'
 *   - status: 'success' | 'failed' (result only)
 *   - failedStep: 'download' | 'downloadASC' | 'verifyASC' | 'verifyPackage' | 'install' (failed only)
 *   - errorMessage: string (failed only)
 *
 * Retry handling:
 *   Each call to downloadPackage() generates a new attemptId. If a user retries,
 *   multiple softwareUpdateStarted / softwareUpdateResult events will be fired
 *   with different attemptIds.
 *   - Funnel queries: use Mixpanel "unique" count (default) to count per-user
 *   - Per-attempt accuracy: group by attemptId to isolate each retry
 *
 * Auto-injected properties (by Analytics module):
 *   - appVersion, appBuildNumber, platform (detailed, e.g. 'ios-phone'),
 *     os, osVersion, x-onekey-request-jsbundle-version
 *
 * Step events (also @LogToServer):
 *   endDownload, endDownloadASC, endVerifyASC, endVerifyPackage, endInstallPackage
 *   - Each carries { success: boolean, error?: string }
 *   - Only success == true completions advance to the next step
 *
 * Mixpanel query examples:
 *
 *   1. Success rate funnel (overall):
 *      Funnel: softwareUpdateStarted -> softwareUpdateResult (status == "success")
 *
 *   2. Success rate by update type:
 *      Same funnel, filter: updateType == "app" or updateType == "bundle"
 *
 *   3. Success rate by client platform:
 *      Same funnel, group by: platform (auto-injected, e.g. "ios-phone", "android-apk")
 *
 *   4. Success rate by app version:
 *      Same funnel, group by: appVersion (auto-injected, e.g. "6.0.0")
 *
 *   5. Failure step breakdown:
 *      Segmentation: softwareUpdateResult, filter: status == "failed", group by: failedStep
 *
 *   6. Failure analysis for a specific version:
 *      Segmentation: softwareUpdateResult,
 *        filter: status == "failed" AND appVersion == "6.1.0",
 *        group by: failedStep
 *
 *   7. Per-step conversion funnel (identify which step has the highest drop-off):
 *      Funnel:
 *        Step 1: softwareUpdateStarted (selector: updateType == "app")
 *        Step 2: endDownload
 *        Step 3: endDownloadASC   (selector: success == true)
 *        Step 4: endVerifyASC     (selector: success == true)
 *        Step 5: endVerifyPackage (selector: success == true)
 *        Step 6: endInstallPackage (selector: success == true)
 *        Step 7: softwareUpdateResult (selector: status == "success")
 *      Group by: platform or appVersion for per-client/per-version breakdown
 */
export class AppUpdateScene extends BaseScene {
  @LogToServer()
  @LogToLocal()
  public softwareUpdateStarted(params: ISoftwareUpdateParams) {
    return params;
  }

  @LogToServer()
  @LogToLocal()
  public softwareUpdateResult(
    params: ISoftwareUpdateParams & {
      status: 'success' | 'failed';
      failedStep?: string;
      errorMessage?: string;
    },
  ) {
    return params;
  }

  @LogToLocal({ level: 'info' })
  public startCheckForUpdates(
    fileType: EUpdateFileType,
    updateStrategy: EUpdateStrategy,
  ) {
    return {
      fileType,
      updateStrategy,
    };
  }

  @LogToLocal({ level: 'info' })
  public fetchConfig(updateInfo: IResponseAppUpdateInfo | undefined) {
    return updateInfo;
  }

  @LogToLocal({ level: 'info' })
  isNeedSyncAppUpdateInfo(isNeedSync: boolean) {
    return isNeedSync;
  }

  @LogToLocal({ level: 'info' })
  public startDownload(params: IDownloadPackageParams) {
    return params;
  }

  @LogToServer()
  @LogToLocal({ level: 'info' })
  public endDownload(params: IUpdateDownloadedEvent) {
    return params;
  }

  @LogToLocal({ level: 'info' })
  public startVerifyPackage(params: IDownloadPackageParams) {
    return params;
  }

  @LogToServer()
  @LogToLocal({ level: 'info' })
  public endVerifyPackage(success: boolean, error?: Error) {
    return { success, error: error?.message };
  }

  @LogToLocal({ level: 'info' })
  public startVerifyASC(params: IDownloadPackageParams) {
    return params;
  }

  @LogToServer()
  @LogToLocal({ level: 'info' })
  public endVerifyASC(success: boolean, error?: Error) {
    return { success, error: error?.message };
  }

  @LogToLocal({ level: 'info' })
  public startDownloadASC(params: IDownloadPackageParams) {
    return params;
  }

  @LogToServer()
  @LogToLocal({ level: 'info' })
  public endDownloadASC(success: boolean, error?: Error) {
    return { success, error: error?.message };
  }

  @LogToLocal({ level: 'info' })
  public startInstallPackage(params: unknown) {
    return params;
  }

  @LogToServer()
  @LogToLocal({ level: 'info' })
  public endInstallPackage(success: boolean, error?: Error) {
    return { success, error: error?.message };
  }

  @LogToLocal({ level: 'info' })
  public restartRNApp() {
    return {};
  }

  @LogToLocal({ level: 'info' })
  public startManualInstallPackage(params: unknown) {
    return params;
  }

  @LogToLocal({ level: 'info' })
  public endManualInstallPackage(success: boolean, error?: Error) {
    return { success, error: error?.message };
  }

  @LogToLocal({ level: 'info' })
  public startCheckForUpdatesOnly() {
    return {};
  }

  @LogToLocal({ level: 'info' })
  public endCheckForUpdates(result: {
    isNeedUpdate: boolean;
    isForceUpdate: boolean;
    updateFileType?: string;
  }) {
    return result;
  }

  @LogToLocal({ level: 'info' })
  public isInstallFailed(
    previousBuildNumber: string,
    currentBuildNumber: string,
  ) {
    return { previousBuildNumber, currentBuildNumber };
  }

  @LogToLocal({ level: 'info' })
  public appUpdateFetchStart(
    payload: IAppUpdateAuditPayload,
    level: 'info' | 'warn' | 'error' = 'info',
  ) {
    return { ...payload, level };
  }

  @LogToLocal({ level: 'info' })
  public appUpdateFetchResult(
    payload: IAppUpdateAuditPayload,
    level: 'info' | 'warn' | 'error' = 'info',
  ) {
    return { ...payload, level };
  }

  @LogToServer()
  @LogToLocal({ level: 'info' })
  public appUpdateDecisionResolved(
    payload: IAppUpdateAuditPayload,
    level: 'info' | 'warn' | 'error' = 'info',
  ) {
    return { ...payload, level };
  }

  @LogToLocal({ level: 'info' })
  public pendingTaskUpsertDecision(
    payload: IAppUpdateAuditPayload,
    level: 'info' | 'warn' | 'error' = 'info',
  ) {
    return { ...payload, level };
  }

  @LogToLocal({ level: 'info' })
  public pendingTaskCleared(
    payload: IAppUpdateAuditPayload,
    level: 'info' | 'warn' | 'error' = 'info',
  ) {
    return { ...payload, level };
  }

  @LogToLocal({ level: 'info' })
  public updateControlFrozenOrIgnored(
    payload: IAppUpdateAuditPayload,
    level: 'info' | 'warn' | 'error' = 'info',
  ) {
    return { ...payload, level };
  }

  @LogToLocal({ level: 'info' })
  public pendingTaskUnknownTypeDropped(
    payload: IAppUpdateAuditPayload,
    level: 'info' | 'warn' | 'error' = 'info',
  ) {
    return { ...payload, level };
  }

  @LogToServer()
  @LogToLocal({ level: 'info' })
  public fullFlowRetryTriggered(
    payload: IAppUpdateAuditPayload,
    level: 'info' | 'warn' | 'error' = 'info',
  ) {
    return { ...payload, level };
  }

  @LogToLocal({ level: 'info' })
  public pendingRetryScheduled(
    payload: IAppUpdateAuditPayload,
    level: 'info' | 'warn' | 'error' = 'info',
  ) {
    return { ...payload, level };
  }

  @LogToLocal({ level: 'info' })
  public pendingPostProcessRefreshStart(
    payload: IAppUpdateAuditPayload,
    level: 'info' | 'warn' | 'error' = 'info',
  ) {
    return { ...payload, level };
  }

  @LogToLocal({ level: 'info' })
  public pendingPostProcessRefreshResult(
    payload: IAppUpdateAuditPayload,
    level: 'info' | 'warn' | 'error' = 'info',
  ) {
    return { ...payload, level };
  }

  @LogToLocal({ level: 'info' })
  public pendingTaskLockState(
    payload: IAppUpdateAuditPayload,
    level: 'info' | 'warn' | 'error' = 'info',
  ) {
    return { ...payload, level };
  }

  @LogToLocal({ level: 'info' })
  public pendingTaskValidation(
    payload: IAppUpdateAuditPayload,
    level: 'info' | 'warn' | 'error' = 'info',
  ) {
    return { ...payload, level };
  }

  @LogToLocal({ level: 'info' })
  public pendingVerifyAfterRestart(
    payload: IAppUpdateAuditPayload,
    level: 'info' | 'warn' | 'error' = 'info',
  ) {
    return { ...payload, level };
  }

  @LogToLocal({ level: 'info' })
  public pendingTaskEnvCheck(
    payload: IAppUpdateAuditPayload,
    level: 'info' | 'warn' | 'error' = 'info',
  ) {
    return { ...payload, level };
  }

  @LogToServer()
  @LogToLocal({ level: 'info' })
  public pendingSwitchStart(
    payload: IAppUpdateAuditPayload,
    level: 'info' | 'warn' | 'error' = 'info',
  ) {
    return { ...payload, level };
  }

  @LogToServer()
  @LogToLocal({ level: 'info' })
  public pendingSwitchResult(
    payload: IAppUpdateAuditPayload,
    level: 'info' | 'warn' | 'error' = 'info',
  ) {
    return { ...payload, level };
  }

  @LogToLocal({ level: 'info' })
  public log(message: string) {
    return message;
  }
}
