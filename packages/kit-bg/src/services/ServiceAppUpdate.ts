import semver from 'semver';

import { appApiClient } from '@onekeyhq/shared/src/appApiClient/appApiClient';
import type {
  IPendingInstallTask,
  IResponseAppUpdateInfo,
} from '@onekeyhq/shared/src/appUpdate';
import {
  EAppUpdateStatus,
  EPendingInstallTaskAction,
  EPendingInstallTaskStatus,
  EPendingInstallTaskType,
  EUpdateStrategy,
  isFirstLaunchAfterUpdated,
  resolveUpdateDecision,
} from '@onekeyhq/shared/src/appUpdate';
import {
  backgroundClass,
  backgroundMethod,
} from '@onekeyhq/shared/src/background/backgroundDecorators';
import { buildServiceEndpoint } from '@onekeyhq/shared/src/config/appConfig';
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import type { IUpdateDownloadedEvent } from '@onekeyhq/shared/src/modules3rdParty/auto-update';
import {
  AppUpdate,
  BundleUpdate,
} from '@onekeyhq/shared/src/modules3rdParty/auto-update';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { memoizee } from '@onekeyhq/shared/src/utils/cacheUtils';
import { generateUUID } from '@onekeyhq/shared/src/utils/miscUtils';
import timerUtils from '@onekeyhq/shared/src/utils/timerUtils';
import { EServiceEndpointEnum } from '@onekeyhq/shared/types/endpoint';

import { appUpdatePersistAtom } from '../states/jotai/atoms';
import { devSettingsPersistAtom } from '../states/jotai/atoms/devSettings';

import ServiceBase from './ServiceBase';
import {
  PLACEHOLDER_SIGNATURE,
  getPendingInstallTask,
  setPendingInstallTask,
} from './servicePendingInstallTask';

let syncTimerId: ReturnType<typeof setTimeout>;
let downloadTimeoutId: ReturnType<typeof setTimeout>;
let failedRecoveryTimerId: ReturnType<typeof setTimeout>;
let firstLaunch = true;

// ---------------------------------------------------------------------------
// Failed-recovery retry tracking
// ---------------------------------------------------------------------------
// When a download/verify fails, startFailedRecoveryTimer resets
// failed → notify after 2 hours so the user (or rollback auto-download)
// gets another attempt.  To prevent infinite retries we count per-target
// resets.  After MAX_FAILED_RECOVERY_RETRY the target is frozen & ignored.
//
// The counter is volatile (resets on app restart) — that is intentional:
// a restart is a fresh environment where the failure may no longer reproduce.
// The freeze/ignoredTargets written to the atom DO survive restarts so a
// target that was already given up on stays ignored.
// ---------------------------------------------------------------------------
const failedRecoveryRetryCount = new Map<string, number>();
const MAX_FAILED_RECOVERY_RETRY = 3;
const FAILED_RECOVERY_FREEZE_MS = 24 * 60 * 60 * 1000; // 24 h
const FAILED_RECOVERY_IGNORE_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 d

// Exposed for tests only — clears volatile retry counters.
export function resetFailedRecoveryRetryCount() {
  failedRecoveryRetryCount.clear();
}

function normalizeOptionalString(value: unknown): string | undefined {
  if (value === null || value === undefined) {
    return undefined;
  }
  return String(value);
}

function normalizeOptionalNumber(value: unknown): number | undefined {
  if (value === null || value === undefined || value === '') {
    return undefined;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

@backgroundClass()
class ServiceAppUpdate extends ServiceBase {
  constructor({ backgroundApi }: { backgroundApi: any }) {
    super({ backgroundApi });
  }

  private isResetting = false;

  private updateAt = 0;

  cachedUpdateInfo: IResponseAppUpdateInfo | undefined;

  private get pendingInstallTaskService() {
    const service = this.backgroundApi.servicePendingInstallTask;
    if (!service) {
      throw new OneKeyLocalError('servicePendingInstallTask is not available');
    }
    return service;
  }

  private buildTaskLogFields(
    task?: Partial<IPendingInstallTask> | null,
  ): Record<string, unknown> {
    return {
      taskId: task?.taskId ?? null,
      revision: task?.revision ?? null,
      action: task?.action ?? null,
      targetAppVersion: task?.targetAppVersion ?? null,
      targetBundleVersion: task?.targetBundleVersion ?? null,
      retryCount: task?.retryCount ?? null,
      nextRetryAt: task?.nextRetryAt ?? null,
    };
  }

  // Schedule a pending task with targetBundleVersion="0" to rollback to
  // the builtin bundle on next cold start.  executeBundleSwitchTask will
  // detect the missing bundle and fall into the existing builtin fallback
  // path: clearPendingInstallTask → resetToBuiltInBundle → restart.
  // Returns true if the task was scheduled, false if skipped.
  private async scheduleRollbackToBuiltinTask({
    reason,
    requestSeq,
    appVersion,
  }: {
    reason: string;
    requestSeq: number;
    appVersion: string;
  }): Promise<boolean> {
    // Don't overwrite in-progress tasks (running / appliedWaitingVerify)
    const existingTask = await getPendingInstallTask();
    if (
      existingTask &&
      (existingTask.status === EPendingInstallTaskStatus.running ||
        existingTask.status === EPendingInstallTaskStatus.appliedWaitingVerify)
    ) {
      defaultLogger.app.appUpdate.log(
        `fetchAppUpdateInfo: ${reason} rollback skipped — existing task in progress`,
      );
      return false;
    }

    defaultLogger.app.appUpdate.log(
      `fetchAppUpdateInfo: ${reason} — scheduling rollback to builtin for next cold start`,
    );
    const [nativeAppVersion, nativeBuildNumber] = await Promise.all([
      BundleUpdate.getNativeAppVersion(),
      BundleUpdate.getNativeBuildNumber(),
    ]);
    const now = Date.now();
    await setPendingInstallTask({
      taskId: `jsbundle:${appVersion}:builtin`,
      revision: requestSeq,
      action: EPendingInstallTaskAction.switchBundle,
      type: EPendingInstallTaskType.jsBundleSwitch,
      targetAppVersion: appVersion,
      targetBundleVersion: '0',
      scheduledEnvAppVersion: nativeAppVersion || platformEnv.version || '',
      scheduledEnvBundleVersion: String(platformEnv.bundleVersion || ''),
      scheduledEnvBuildNumber: nativeBuildNumber || '',
      createdAt: now,
      expiresAt: now + timerUtils.getTimeDurationMs({ day: 7 }),
      retryCount: 0,
      status: EPendingInstallTaskStatus.pending,
      payload: {
        appVersion,
        bundleVersion: '0',
        signature: PLACEHOLDER_SIGNATURE,
      },
    });
    return true;
  }

  private getTargetKey(taskOrTarget: {
    targetAppVersion: string;
    targetBundleVersion: string;
  }) {
    return this.pendingInstallTaskService.getTargetKey(taskOrTarget);
  }

  private async nextRequestSeq() {
    return this.pendingInstallTaskService.nextRequestSeq();
  }

  private async cleanupUpdateControlState() {
    await this.pendingInstallTaskService.cleanupUpdateControlState();
  }

  private async shouldSkipTargetByControl(
    targetKey: string,
    traceId: string,
    requestSeq: number,
    emitLog = true,
  ) {
    return this.pendingInstallTaskService.shouldSkipTargetByControl(
      targetKey,
      traceId,
      requestSeq,
      emitLog,
    );
  }

  private async syncPendingInstallTaskWithReleaseInfo(args: {
    releaseInfo: IResponseAppUpdateInfo | undefined;
    requestSeq: number;
    traceId: string;
    stage: 'fetch' | 'ready_to_install';
    appInfo?: Awaited<ReturnType<typeof appUpdatePersistAtom.get>>;
  }) {
    await this.pendingInstallTaskService.syncPendingInstallTaskWithReleaseInfo(
      args,
    );
  }

  // Compute the target key from atom state.  Must produce the same key that
  // buildPendingAppShellTask / buildPendingJsBundleTask would produce so that
  // freeze/ignore checks are consistent across the download gate (here) and
  // the pending-task engine.
  private computeUpdateTargetKey(appInfo: {
    latestVersion?: string;
    jsBundleVersion?: string | null;
  }): string | null {
    if (!appInfo.latestVersion) return null;
    const decision = resolveUpdateDecision({
      currentAppVersion: platformEnv.version,
      currentBundleVersion: platformEnv.bundleVersion,
      remoteAppVersion: appInfo.latestVersion,
      remoteBundleVersion: appInfo.jsBundleVersion ?? undefined,
      allowRollback: true,
    });
    if (
      decision.decision === 'appShellUpdate' ||
      decision.decision === 'jsBundleUpgrade' ||
      decision.decision === 'jsBundleRollback'
    ) {
      const targetBundleVersion =
        decision.decision === 'appShellUpdate'
          ? appInfo.jsBundleVersion || String(platformEnv.bundleVersion || '')
          : appInfo.jsBundleVersion;
      // For jsBundleUpgrade/jsBundleRollback, jsBundleVersion must be present
      // (resolveUpdateDecision requires remoteBundleVersion). Return null if
      // unexpectedly empty rather than using a mismatched fallback.
      if (!targetBundleVersion) return null;
      return this.getTargetKey({
        targetAppVersion: appInfo.latestVersion,
        targetBundleVersion,
      });
    }
    return null;
  }

  private shouldUpdateFromReleaseInfo(
    releaseInfo: IResponseAppUpdateInfo,
    hasActiveCustomBundle = false,
  ) {
    const resolved = resolveUpdateDecision({
      currentAppVersion: platformEnv.version,
      currentBundleVersion: platformEnv.bundleVersion,
      remoteAppVersion: releaseInfo.version,
      remoteBundleVersion: releaseInfo.jsBundleVersion,
      allowRollback: true,
      hasActiveCustomBundle,
    });
    return (
      resolved.decision === 'appShellUpdate' ||
      resolved.decision === 'jsBundleUpgrade' ||
      resolved.decision === 'jsBundleRollback' ||
      resolved.decision === 'jsBundleRollbackToBuiltin'
    );
  }

  // After a download/verify failure the timer resets failed → notify so the
  // user (or rollback auto-download) gets another chance.  A per-target retry
  // counter prevents infinite loops: after MAX_FAILED_RECOVERY_RETRY resets
  // the target is frozen and added to ignoredTargets.
  private startFailedRecoveryTimer() {
    clearTimeout(failedRecoveryTimerId);
    failedRecoveryTimerId = setTimeout(
      async () => {
        const appInfo = await appUpdatePersistAtom.get();
        defaultLogger.app.appUpdate.log(
          `Failed recovery timer fired, current status: ${appInfo.status}`,
        );
        if (!ServiceAppUpdate.FAILED_STATUSES.includes(appInfo.status)) {
          return;
        }

        // --- retry-limit gate ---
        const targetKey = this.computeUpdateTargetKey(appInfo);
        if (targetKey) {
          const prev = failedRecoveryRetryCount.get(targetKey) || 0;
          const next = prev + 1;
          failedRecoveryRetryCount.set(targetKey, next);

          if (next > MAX_FAILED_RECOVERY_RETRY) {
            // Exhausted — freeze and ignore this target.
            const now = Date.now();
            defaultLogger.app.appUpdate.log(
              `Failed recovery: retry exhausted for ${targetKey} (count=${next}), freezing`,
            );
            await appUpdatePersistAtom.set((p) => ({
              ...p,
              freezeUntil: now + FAILED_RECOVERY_FREEZE_MS,
              ignoredTargets: {
                ...p.ignoredTargets,
                [targetKey]: {
                  reason: 'DOWNLOAD_RETRY_EXHAUSTED',
                  createdAt: now,
                  expiresAt: now + FAILED_RECOVERY_IGNORE_TTL_MS,
                },
              },
            }));
            return;
          }
          defaultLogger.app.appUpdate.log(
            `Failed recovery: resetting for ${targetKey} (retry ${next}/${MAX_FAILED_RECOVERY_RETRY})`,
          );
        }

        // --- reset failed → notify for another attempt ---
        const shouldClearDownload =
          ServiceAppUpdate.VERIFY_FAILED_STATUSES.includes(appInfo.status) ||
          appInfo.status === EAppUpdateStatus.failed ||
          appInfo.status === EAppUpdateStatus.updateIncomplete;
        await appUpdatePersistAtom.set((p) => ({
          ...p,
          errorText: undefined,
          status: EAppUpdateStatus.notify,
          downloadedEvent: shouldClearDownload ? undefined : p.downloadedEvent,
        }));
      },
      timerUtils.getTimeDurationMs({ hour: 2 }),
    );
  }

  @backgroundMethod()
  async processPendingInstallTask() {
    await this.pendingInstallTaskService.processPendingInstallTask();
  }

  @backgroundMethod()
  async fetchConfig() {
    const client = await this.getClient(EServiceEndpointEnum.Utility);
    const response = await client.get<{
      code: number;
      data: IResponseAppUpdateInfo;
    }>('/utility/v1/app-update');
    const { code, data } = response.data;
    if (code === 0 && data) {
      const normalizedUpdateStrategy =
        data.updateStrategy === undefined ||
        data.updateStrategy === null ||
        (data.updateStrategy as unknown) === ''
          ? undefined
          : Number(data.updateStrategy);
      const normalizedData: IResponseAppUpdateInfo = {
        ...data,
        updateStrategy: (normalizedUpdateStrategy ??
          data.updateStrategy) as EUpdateStrategy,
        version: normalizeOptionalString(data.version),
        storeUrl: normalizeOptionalString(data.storeUrl),
        downloadUrl: normalizeOptionalString(data.downloadUrl),
        changeLog: normalizeOptionalString(data.changeLog),
        summary: normalizeOptionalString(data.summary),
        jsBundleVersion: normalizeOptionalString(data.jsBundleVersion),
        fileSize: normalizeOptionalNumber(data.fileSize),
        jsBundleCount: normalizeOptionalNumber(data.jsBundleCount),
        jsBundle: data.jsBundle
          ? {
              downloadUrl: normalizeOptionalString(data.jsBundle.downloadUrl),
              fileSize: normalizeOptionalNumber(data.jsBundle.fileSize),
              sha256: normalizeOptionalString(data.jsBundle.sha256),
              signature: normalizeOptionalString(data.jsBundle.signature),
            }
          : undefined,
      };
      // Security: Validate updateStrategy is a known enum value
      if (
        normalizedUpdateStrategy !== undefined &&
        !Number.isFinite(normalizedUpdateStrategy)
      ) {
        defaultLogger.app.appUpdate.endInstallPackage(
          false,
          new Error(
            `Invalid updateStrategy value: ${String(data.updateStrategy)}`,
          ),
        );
        return this.cachedUpdateInfo;
      }
      if (
        normalizedData.updateStrategy !== undefined &&
        ![
          EUpdateStrategy.silent,
          EUpdateStrategy.force,
          EUpdateStrategy.manual,
          EUpdateStrategy.seamless,
        ].includes(normalizedData.updateStrategy)
      ) {
        defaultLogger.app.appUpdate.endInstallPackage(
          false,
          new Error(
            `Invalid updateStrategy value: ${String(
              normalizedData.updateStrategy,
            )}`,
          ),
        );
        return this.cachedUpdateInfo;
      }
      // Security: Validate jsBundle fields if present
      if (normalizedData.jsBundle) {
        if (
          normalizedData.jsBundle.downloadUrl &&
          !normalizedData.jsBundle.downloadUrl.startsWith('https://')
        ) {
          defaultLogger.app.appUpdate.endInstallPackage(
            false,
            new Error('jsBundle downloadUrl must use HTTPS'),
          );
          return this.cachedUpdateInfo;
        }
      }
      this.updateAt = Date.now();
      this.cachedUpdateInfo = normalizedData;
    }
    return this.cachedUpdateInfo;
  }

  @backgroundMethod()
  async getAppLatestInfo(forceUpdate = false) {
    if (
      !forceUpdate &&
      Date.now() - this.updateAt <
        timerUtils.getTimeDurationMs({
          minute: 5,
        }) &&
      this.cachedUpdateInfo
    ) {
      return this.cachedUpdateInfo;
    }
    return this.fetchConfig();
  }

  @backgroundMethod()
  async getUpdateStatus() {
    const appInfo = await appUpdatePersistAtom.get();
    return appInfo.status;
  }

  static FAILED_STATUSES: EAppUpdateStatus[] = [
    EAppUpdateStatus.downloadPackageFailed,
    EAppUpdateStatus.downloadASCFailed,
    EAppUpdateStatus.verifyASCFailed,
    EAppUpdateStatus.verifyPackageFailed,
    EAppUpdateStatus.failed,
    EAppUpdateStatus.updateIncomplete,
  ];

  static VERIFY_FAILED_STATUSES: EAppUpdateStatus[] = [
    EAppUpdateStatus.verifyASCFailed,
    EAppUpdateStatus.verifyPackageFailed,
  ];

  // Called by:
  //   - hooks.tsx isFirstLaunchAfterUpdated branch (once per app lifecycle)
  //   - servicePendingInstallTask post-process refresh
  //
  // NOT called by fetchAppUpdateInfo (removed to prevent infinite retry
  // loops — see comment in fetchAppUpdateInfo).
  //
  // The failed → notify branch below is a safety net.  The primary
  // failed → notify path is startFailedRecoveryTimer (with retry limit).
  @backgroundMethod()
  async refreshUpdateStatus() {
    const appInfo = await appUpdatePersistAtom.get();
    if (isFirstLaunchAfterUpdated(appInfo)) {
      defaultLogger.app.appUpdate.log(
        'refreshUpdateStatus: first launch after updated, resetting to done',
      );
      await appUpdatePersistAtom.set((prev) => ({
        ...prev,
        updateAt: 0,
        updateStrategy: EUpdateStrategy.manual,
        errorText: undefined,
        status: EAppUpdateStatus.done,
        jsBundleVersion: undefined,
        jsBundle: undefined,
        downloadedEvent: undefined,
      }));
    } else if (ServiceAppUpdate.FAILED_STATUSES.includes(appInfo.status)) {
      // Safety net: also subject to the same retry limit as
      // startFailedRecoveryTimer to prevent infinite resets.
      const targetKey = this.computeUpdateTargetKey(appInfo);
      if (targetKey) {
        const prev = failedRecoveryRetryCount.get(targetKey) || 0;
        if (prev >= MAX_FAILED_RECOVERY_RETRY) {
          defaultLogger.app.appUpdate.log(
            `refreshUpdateStatus: retry exhausted for ${targetKey} (count=${prev}), skipping reset`,
          );
          return;
        }
        failedRecoveryRetryCount.set(targetKey, prev + 1);
      }

      defaultLogger.app.appUpdate.log(
        `refreshUpdateStatus: resetting failed status ${appInfo.status} to notify`,
      );
      const shouldClearDownload =
        ServiceAppUpdate.VERIFY_FAILED_STATUSES.includes(appInfo.status) ||
        appInfo.status === EAppUpdateStatus.failed ||
        appInfo.status === EAppUpdateStatus.updateIncomplete;
      await appUpdatePersistAtom.set((prev) => ({
        ...prev,
        errorText: undefined,
        status: EAppUpdateStatus.notify,
        downloadedEvent: shouldClearDownload ? undefined : prev.downloadedEvent,
      }));
    }
  }

  @backgroundMethod()
  async isNeedSyncAppUpdateInfo(forceUpdate = false) {
    const { updateAt } = await appUpdatePersistAtom.get();
    clearTimeout(syncTimerId);

    if (firstLaunch) {
      firstLaunch = false;
      return true;
    }

    if (forceUpdate) {
      return true;
    }

    const timeout =
      timerUtils.getTimeDurationMs({
        hour: 1,
      }) +
      timerUtils.getTimeDurationMs({
        minute: 30,
      }) *
        Math.random();
    syncTimerId = setTimeout(() => {
      void this.fetchAppUpdateInfo();
    }, timeout);
    const now = Date.now();
    if (platformEnv.isExtension) {
      return (
        now - updateAt >
        timerUtils.getTimeDurationMs({
          day: 1,
        })
      );
    }
    return (
      now - updateAt >
      timerUtils.getTimeDurationMs({
        hour: 1,
      })
    );
  }

  // States from which downloadPackage is allowed to be called
  static DOWNLOAD_ENTRY_STATUSES: EAppUpdateStatus[] = [
    EAppUpdateStatus.notify,
    EAppUpdateStatus.done,
    EAppUpdateStatus.downloadPackage, // retry during download
    ...ServiceAppUpdate.FAILED_STATUSES,
  ];

  @backgroundMethod()
  public async downloadPackage() {
    const { status } = await appUpdatePersistAtom.get();
    if (!ServiceAppUpdate.DOWNLOAD_ENTRY_STATUSES.includes(status)) {
      defaultLogger.app.appUpdate.log(
        `downloadPackage: rejected, current status=${status}`,
      );
      return;
    }
    clearTimeout(downloadTimeoutId);
    clearTimeout(failedRecoveryTimerId);
    downloadTimeoutId = setTimeout(
      async () => {
        await this.downloadPackageFailed({
          message: ETranslations.update_download_timed_out_check_connection,
        });
      },
      timerUtils.getTimeDurationMs({ minute: 30 }),
    );
    await appUpdatePersistAtom.set((prev) => ({
      ...prev,
      downloadedEvent: undefined,
      status: EAppUpdateStatus.downloadPackage,
    }));
  }

  @backgroundMethod()
  updateErrorText(status: EAppUpdateStatus, errorText: string) {
    void appUpdatePersistAtom.set((prev) => ({
      ...prev,
      errorText: errorText as ETranslations,
      status,
    }));
  }

  @backgroundMethod()
  public async downloadPackageFailed(e?: { message: string }) {
    const { status } = await appUpdatePersistAtom.get();
    if (status !== EAppUpdateStatus.downloadPackage) {
      defaultLogger.app.appUpdate.log(
        `downloadPackageFailed: rejected, current status=${status}`,
      );
      return;
    }
    clearTimeout(downloadTimeoutId);
    // TODO: need replace by error code.
    let errorText: ETranslations | string =
      e?.message || ETranslations.update_network_exception_check_connection;
    if (errorText.includes('Server not responding')) {
      errorText = ETranslations.update_server_not_responding_try_later;
    } else if (errorText.startsWith('Cannot download')) {
      errorText = ETranslations.update_server_not_responding_try_later;
    } else if (errorText.includes('Software caused connection abort')) {
      errorText = ETranslations.update_network_instability_check_connection;
    }
    const statusNumber = e?.message ? Number(e.message) : undefined;
    if (statusNumber === 500) {
      errorText = ETranslations.update_server_not_responding_try_later;
    } else if (statusNumber === 404 || statusNumber === 403) {
      errorText = ETranslations.update_server_not_responding_try_later;
    }
    defaultLogger.app.error.log(e?.message || errorText);
    this.updateErrorText(EAppUpdateStatus.downloadPackageFailed, errorText);
    this.startFailedRecoveryTimer();
  }

  @backgroundMethod()
  public async updateDownloadedEvent(downloadedEvent: IUpdateDownloadedEvent) {
    await appUpdatePersistAtom.set((prev) => ({
      ...prev,
      downloadedEvent,
    }));
  }

  @backgroundMethod()
  public async updateDownloadUrl(downloadUrl: string) {
    // Security: Reject empty or non-HTTPS download URLs
    if (!downloadUrl || !downloadUrl.startsWith('https://')) {
      defaultLogger.app.appUpdate.log(
        `updateDownloadUrl: invalid URL rejected: ${downloadUrl}`,
      );
      defaultLogger.app.appUpdate.endInstallPackage(
        false,
        new Error('Download URL must be a non-empty HTTPS URL'),
      );
      return;
    }
    await appUpdatePersistAtom.set((prev) => ({
      ...prev,
      downloadedEvent: {
        ...prev.downloadedEvent,
        downloadUrl,
      },
    }));
  }

  @backgroundMethod()
  public async getDownloadEvent() {
    const appInfo = await appUpdatePersistAtom.get();
    return appInfo.downloadedEvent;
  }

  @backgroundMethod()
  public async getUpdateInfo() {
    const appInfo = await appUpdatePersistAtom.get();
    return appInfo;
  }

  @backgroundMethod()
  public async verifyPackage() {
    const { status } = await appUpdatePersistAtom.get();
    if (
      status !== EAppUpdateStatus.verifyASC &&
      status !== EAppUpdateStatus.verifyPackage &&
      status !== EAppUpdateStatus.verifyPackageFailed
    ) {
      defaultLogger.app.appUpdate.log(
        `verifyPackage: rejected, current status=${status}`,
      );
      return;
    }
    clearTimeout(downloadTimeoutId);
    await appUpdatePersistAtom.set((prev) => ({
      ...prev,
      status: EAppUpdateStatus.verifyPackage,
    }));
  }

  @backgroundMethod()
  public async verifyASC() {
    const { status } = await appUpdatePersistAtom.get();
    if (
      status !== EAppUpdateStatus.downloadASC &&
      status !== EAppUpdateStatus.verifyASC &&
      status !== EAppUpdateStatus.verifyASCFailed
    ) {
      defaultLogger.app.appUpdate.log(
        `verifyASC: rejected, current status=${status}`,
      );
      return;
    }
    clearTimeout(downloadTimeoutId);
    await appUpdatePersistAtom.set((prev) => ({
      ...prev,
      status: EAppUpdateStatus.verifyASC,
    }));
  }

  @backgroundMethod()
  public async downloadASC() {
    const { status } = await appUpdatePersistAtom.get();
    if (
      status !== EAppUpdateStatus.downloadPackage &&
      status !== EAppUpdateStatus.downloadASC
    ) {
      defaultLogger.app.appUpdate.log(
        `downloadASC: rejected, current status=${status}`,
      );
      return;
    }
    clearTimeout(downloadTimeoutId);
    await appUpdatePersistAtom.set((prev) => ({
      ...prev,
      status: EAppUpdateStatus.downloadASC,
    }));
  }

  @backgroundMethod()
  public async verifyASCFailed(e?: { message: string }) {
    const { status } = await appUpdatePersistAtom.get();
    if (status !== EAppUpdateStatus.verifyASC) {
      defaultLogger.app.appUpdate.log(
        `verifyASCFailed: rejected, current status=${status}`,
      );
      return;
    }
    let errorText =
      e?.message ||
      ETranslations.update_signature_verification_failed_alert_text;
    if (platformEnv.isNativeAndroid) {
      if (errorText === 'UPDATE_SIGNATURE_VERIFICATION_FAILED_ALERT_TEXT')
        errorText =
          ETranslations.update_signature_verification_failed_alert_text;
    }
    defaultLogger.app.error.log(e?.message || errorText);
    await appUpdatePersistAtom.set((prev) => ({
      ...prev,
      errorText: errorText as ETranslations,
      status: EAppUpdateStatus.verifyASCFailed,
    }));
    this.startFailedRecoveryTimer();
  }

  @backgroundMethod()
  public async verifyPackageFailed(e?: { message: string }) {
    const { status } = await appUpdatePersistAtom.get();
    if (status !== EAppUpdateStatus.verifyPackage) {
      defaultLogger.app.appUpdate.log(
        `verifyPackageFailed: rejected, current status=${status}`,
      );
      return;
    }
    let errorText =
      e?.message || ETranslations.update_installation_not_safe_alert_text;
    if (platformEnv.isNativeAndroid) {
      if (errorText === 'PACKAGE_NAME_MISMATCH') {
        errorText = ETranslations.update_package_name_mismatch;
      } else if (errorText === 'UPDATE_INSTALLATION_NOT_SAFE_ALERT_TEXT') {
        errorText = ETranslations.update_installation_not_safe_alert_text;
      }
    }
    defaultLogger.app.error.log(e?.message || errorText);
    await appUpdatePersistAtom.set((prev) => ({
      ...prev,
      errorText: errorText as ETranslations,
      status: EAppUpdateStatus.verifyPackageFailed,
    }));
    this.startFailedRecoveryTimer();
  }

  @backgroundMethod()
  public async downloadASCFailed(e?: { message: string }) {
    const { status } = await appUpdatePersistAtom.get();
    if (status !== EAppUpdateStatus.downloadASC) {
      defaultLogger.app.appUpdate.log(
        `downloadASCFailed: rejected, current status=${status}`,
      );
      return;
    }
    const statusNumber = e?.message ? Number(e.message) : undefined;
    let errorText = '';
    if (statusNumber === 500) {
      errorText = ETranslations.update_server_not_responding_try_later;
    } else if (statusNumber === 404 || statusNumber === 403) {
      errorText = ETranslations.update_server_not_responding_try_later;
    } else {
      errorText = ETranslations.update_network_instability_check_connection;
    }
    defaultLogger.app.error.log(e?.message || errorText);
    this.updateErrorText(EAppUpdateStatus.downloadASCFailed, errorText);
    this.startFailedRecoveryTimer();
  }

  @backgroundMethod()
  public async readyToInstall() {
    const appInfo = await appUpdatePersistAtom.get();
    const { status } = appInfo;
    if (
      status !== EAppUpdateStatus.verifyPackage &&
      status !== EAppUpdateStatus.ready
    ) {
      defaultLogger.app.appUpdate.log(
        `readyToInstall: rejected, current status=${status}`,
      );
      return;
    }
    clearTimeout(downloadTimeoutId);
    clearTimeout(failedRecoveryTimerId);
    await appUpdatePersistAtom.set((prev) => ({
      ...prev,
      status: EAppUpdateStatus.ready,
    }));

    const latest = await appUpdatePersistAtom.get();
    if (!latest.latestVersion && !latest.jsBundleVersion) {
      return;
    }
    const traceId = generateUUID();
    const requestSeq = await this.nextRequestSeq();
    await this.syncPendingInstallTaskWithReleaseInfo({
      releaseInfo: {
        version: latest.latestVersion,
        jsBundleVersion: latest.jsBundleVersion,
        updateStrategy: latest.updateStrategy,
        jsBundle: latest.jsBundle,
        downloadUrl: latest.downloadUrl,
        storeUrl: latest.storeUrl,
        changeLog: latest.changeLog,
        fileSize: latest.fileSize,
        summary: latest.summary,
      },
      requestSeq,
      traceId,
      stage: 'ready_to_install',
      appInfo: latest,
    });
  }

  @backgroundMethod()
  public async reset() {
    clearTimeout(syncTimerId);
    clearTimeout(downloadTimeoutId);
    clearTimeout(failedRecoveryTimerId);
    await appUpdatePersistAtom.set({
      latestVersion: platformEnv.version,
      jsBundleVersion: platformEnv.bundleVersion,
      updateStrategy: EUpdateStrategy.manual,
      updateAt: 0,
      summary: '',
      status: EAppUpdateStatus.done,
      jsBundle: undefined,
      previousAppVersion: undefined,
      isRollbackTarget: undefined,
      downloadedEvent: undefined,
    });
    await this.backgroundApi.serviceApp.resetLaunchTimesAfterUpdate();
    // Schedule an immediate check so that if a newer version was released
    // while the user was installing the current one, it's discovered right away
    // instead of waiting for the next 1–1.5 hour sync cycle.
    // Guard against re-entrancy: if fetchAppUpdateInfo gets empty data from the
    // server it calls reset() again, which would schedule another fetch, creating
    // an infinite loop.  The isResetting flag breaks the cycle.
    if (!this.isResetting) {
      this.isResetting = true;
      setTimeout(() => {
        void this.fetchAppUpdateInfo().finally(() => {
          this.isResetting = false;
        });
      }, 0);
    }
  }

  @backgroundMethod()
  public async resetToManualInstall() {
    await appUpdatePersistAtom.set((prev) => ({
      ...prev,
      errorText: undefined,
      status: EAppUpdateStatus.manualInstall,
    }));
  }

  @backgroundMethod()
  public async resetToInComplete() {
    await appUpdatePersistAtom.set((prev) => ({
      ...prev,
      errorText: undefined,
      status: EAppUpdateStatus.updateIncomplete,
    }));
  }

  @backgroundMethod()
  public async updateLastDialogShownAt() {
    await appUpdatePersistAtom.set((prev) => ({
      ...prev,
      lastUpdateDialogShownAt: Date.now(),
    }));
  }

  @backgroundMethod()
  public async clearLastDialogShownAt() {
    await appUpdatePersistAtom.set((prev) => ({
      ...prev,
      lastUpdateDialogShownAt: undefined,
    }));
  }

  @backgroundMethod()
  public async clearCache() {
    clearTimeout(downloadTimeoutId);
    await AppUpdate.clearPackage();
    await BundleUpdate.clearDownload();
    await this.backgroundApi.servicePendingInstallTask.clearPendingInstallTask();
    await this.reset();
  }

  fetchAppChangeLog = memoizee(
    async () => {
      const client = await this.getClient(EServiceEndpointEnum.Utility);
      const response = await client.get<{
        code: number;
        data: {
          changeLog: string;
        };
      }>('/utility/v1/app-update/version-info');
      const { code, data } = response.data;
      return code === 0 ? data?.changeLog : undefined;
    },
    {
      maxAge: timerUtils.getTimeDurationMs({ minute: 5 }),
      promise: true,
    },
  );

  @backgroundMethod()
  public async fetchChangeLog() {
    const changeLog = await this.fetchAppChangeLog();
    return changeLog;
  }

  @backgroundMethod()
  public async fetchAppUpdateInfo(forceUpdate = false) {
    const traceId = generateUUID();
    const requestSeq = await this.nextRequestSeq();
    defaultLogger.app.appUpdate.appUpdateFetchStart({
      traceId,
      requestSeq,
      forceUpdate,
      taskId: null,
      revision: null,
      action: null,
    });

    // Dev mode: skip all server bundle update checks when the toggle is on.
    // This prevents auto-rollback from interfering with QA/dev bundle testing.
    try {
      const devSettings = await devSettingsPersistAtom.get();
      if (
        devSettings.enabled &&
        devSettings.settings?.ignoreServerBundleUpdate
      ) {
        defaultLogger.app.appUpdate.log(
          'fetchAppUpdateInfo: skipped — ignoreServerBundleUpdate is enabled',
        );
        return await appUpdatePersistAtom.get();
      }
    } catch {
      // ignore — proceed with normal flow
    }

    // If a pending install task exists but hasn't been executed yet,
    // skip the fetch to prevent the atom / pending task from being
    // overwritten with newer server data before the scheduled task runs.
    // This avoids a race where:
    //   1. v101 pending task is waiting for next cold start
    //   2. fetchAppUpdateInfo gets v102, updates atom to v102
    //   3. App restarts → v101 task executes, but atom says v102
    // By blocking the fetch, we ensure the pending task completes first.
    try {
      const pendingTask = await getPendingInstallTask();
      if (
        pendingTask &&
        (pendingTask.status === EPendingInstallTaskStatus.pending ||
          pendingTask.status === EPendingInstallTaskStatus.running)
      ) {
        defaultLogger.app.appUpdate.appUpdateFetchResult({
          traceId,
          requestSeq,
          hasReleaseInfo: null,
          httpStatus: null,
          reason: 'skip_pending_task_not_executed',
          finalStatus: (await appUpdatePersistAtom.get()).status,
        });
        return await appUpdatePersistAtom.get();
      }
    } catch {
      // ignore — proceed with normal flow
    }

    await this.cleanupUpdateControlState();
    // NOTE: refreshUpdateStatus() was previously called here, but it resets
    // ANY failed status to notify unconditionally — including same-version
    // failures.  For rollback targets (which auto-download on notify) this
    // created an infinite download → fail → reset → download loop.
    //
    // The failed → notify transition is now handled by:
    //   1. startFailedRecoveryTimer  — 2 h fallback with per-target retry
    //      limit; freezes the target after MAX_FAILED_RECOVERY_RETRY.
    //   2. The atom-set logic below  — resets only when the server pushes a
    //      *different* version (isDifferentFromAttempted).
    //
    // downloading app or ready to update via local package
    const isNeedSync = await this.isNeedSyncAppUpdateInfo(forceUpdate);
    defaultLogger.app.appUpdate.isNeedSyncAppUpdateInfo(isNeedSync);
    if (!isNeedSync) {
      const latest = await appUpdatePersistAtom.get();
      defaultLogger.app.appUpdate.appUpdateFetchResult({
        traceId,
        requestSeq,
        hasReleaseInfo: null,
        httpStatus: null,
        reason: 'skip_sync',
        finalStatus: latest.status,
      });
      return latest;
    }

    const releaseInfo = await this.getAppLatestInfo(forceUpdate);
    defaultLogger.app.appUpdate.fetchConfig(releaseInfo);
    defaultLogger.app.appUpdate.appUpdateFetchResult(
      {
        traceId,
        requestSeq,
        hasReleaseInfo: !!releaseInfo,
        httpStatus: null,
      },
      releaseInfo ? 'info' : 'warn',
    );
    // jsBundleCount === 0 means the server has no hot-update records for
    // this version — admin removed them.  If the client has an active
    // custom bundle, schedule a rollback to builtin on next cold start.
    // jsBundleCount > 0 means hot-update records exist but the client
    // already has the same bundleVersion (filtered by server's $ne query)
    // — no action needed, fall through to normal flow.
    if (
      typeof releaseInfo?.jsBundleCount === 'number' &&
      releaseInfo.jsBundleCount === 0
    ) {
      let hasActiveCustomBundle = false;
      try {
        const jsBundlePath = await BundleUpdate.getJsBundlePath();
        hasActiveCustomBundle = !!jsBundlePath;
      } catch {
        // ignore — default to false
      }

      if (hasActiveCustomBundle) {
        defaultLogger.app.appUpdate.appUpdateDecisionResolved({
          traceId,
          requestSeq,
          decision: 'jsBundleRollbackToBuiltin',
          reason: 'jsBundleCount_is_zero',
          allowRollback: true,
          currentAppVersion: platformEnv.version || '',
          currentBundleVersion: String(platformEnv.bundleVersion || ''),
          targetAppVersion: null,
          targetBundleVersion: null,
          ...this.buildTaskLogFields(null),
        });
        await this.scheduleRollbackToBuiltinTask({
          reason: 'jsBundleCount_is_zero',
          requestSeq,
          appVersion: platformEnv.version || '',
        });
        await appUpdatePersistAtom.set((prev) => ({
          ...prev,
          updateAt: Date.now(),
        }));
        const latest = await appUpdatePersistAtom.get();
        return latest;
      }
    }

    if (releaseInfo?.version || releaseInfo?.jsBundleVersion) {
      let hasActiveCustomBundle = false;
      try {
        const jsBundlePath = await BundleUpdate.getJsBundlePath();
        hasActiveCustomBundle = !!jsBundlePath;
      } catch {
        // ignore — default to false
      }
      // When the server finds appVersion and bundleVersion match the
      // client's current versions, it returns a response like:
      //   { version: "5.x.x", jsBundleCount: 3, jsBundleVersion: undefined }
      // jsBundleCount > 0 indicates bundles exist on server, but
      // jsBundleVersion is omitted (no newer bundle available).
      // In this case, don't treat the absent jsBundleVersion as a
      // rollback signal — the client is already on the latest bundle.
      if (
        typeof releaseInfo?.jsBundleCount === 'number' &&
        releaseInfo.jsBundleCount > 0 &&
        !releaseInfo.jsBundleVersion
      ) {
        hasActiveCustomBundle = false;
      }
      const decision = resolveUpdateDecision({
        currentAppVersion: platformEnv.version,
        currentBundleVersion: platformEnv.bundleVersion,
        remoteAppVersion: releaseInfo.version,
        remoteBundleVersion: releaseInfo.jsBundleVersion,
        allowRollback: true,
        hasActiveCustomBundle,
      });
      defaultLogger.app.appUpdate.appUpdateDecisionResolved(
        {
          traceId,
          requestSeq,
          decision: decision.decision,
          reason: decision.reason,
          allowRollback: true,
          currentAppVersion: platformEnv.version || '',
          currentBundleVersion: String(platformEnv.bundleVersion || ''),
          targetAppVersion: releaseInfo.version ?? null,
          targetBundleVersion: releaseInfo.jsBundleVersion ?? null,
          ...this.buildTaskLogFields(null),
        },
        decision.isValid ? 'info' : 'warn',
      );

      // Rollback to builtin: no download needed — schedule a pending task
      // with targetBundleVersion="0" so the reset happens on next cold start,
      // consistent with jsBundleRollback behavior.
      //
      // On cold start, executeBundleSwitchTask will:
      //   1. isBundleExists("X.Y.Z", "0") → false
      //   2. targetBundle(0) < currentBundle → true (rollback)
      //   3. Fall into the existing builtin fallback path:
      //      clearPendingInstallTask → resetToBuiltInBundle → restart
      if (decision.decision === 'jsBundleRollbackToBuiltin') {
        await this.scheduleRollbackToBuiltinTask({
          reason: 'jsBundleRollbackToBuiltin',
          requestSeq,
          appVersion: releaseInfo.version || platformEnv.version || '',
        });
        await appUpdatePersistAtom.set((prev) => ({
          ...prev,
          updateAt: Date.now(),
        }));
        const latest = await appUpdatePersistAtom.get();
        return latest;
      }

      let shouldUpdate = this.shouldUpdateFromReleaseInfo(
        releaseInfo,
        hasActiveCustomBundle,
      );
      if (
        (decision.decision === 'jsBundleUpgrade' ||
          decision.decision === 'jsBundleRollback' ||
          decision.decision === 'appShellUpdate') &&
        releaseInfo.version &&
        (releaseInfo.jsBundleVersion || decision.decision === 'appShellUpdate')
      ) {
        // Must use the same bundleVersion fallback as
        // buildPendingAppShellTask (which uses platformEnv.bundleVersion)
        // so the target key matches for freeze/ignore checks.
        const targetKey = this.getTargetKey({
          targetAppVersion: releaseInfo.version,
          targetBundleVersion:
            decision.decision === 'appShellUpdate'
              ? releaseInfo.jsBundleVersion ||
                String(platformEnv.bundleVersion || '')
              : releaseInfo.jsBundleVersion!,
        });
        const blockedByControl = await this.shouldSkipTargetByControl(
          targetKey,
          traceId,
          requestSeq,
          false,
        );
        if (blockedByControl) {
          shouldUpdate = false;
          defaultLogger.app.appUpdate.pendingTaskUpsertDecision({
            traceId,
            requestSeq,
            upsertAction: 'drop',
            reason: 'frozen_or_ignored_target_for_notify',
            target: targetKey,
          });
        }
      }

      await appUpdatePersistAtom.set((prev) => {
        const isUpdating = prev.status !== EAppUpdateStatus.done;

        // Check if the current state is a failed state and the server has
        // a newer version than the one we were trying to update to.
        // In that case, reset to notify so the user gets the new version
        // instead of retrying a stale download.
        const isFailed = ServiceAppUpdate.FAILED_STATUSES.includes(prev.status);
        let isDifferentFromAttempted = false;
        if (isFailed && releaseInfo.version && prev.latestVersion) {
          try {
            isDifferentFromAttempted =
              semver.gt(releaseInfo.version, prev.latestVersion) ||
              semver.lt(releaseInfo.version, prev.latestVersion);
          } catch (error) {
            defaultLogger.app.appUpdate.log(
              `fetchAppUpdateInfo: semver compare failed, releaseVersion=${
                releaseInfo.version ?? 'nil'
              }, prevVersion=${prev.latestVersion ?? 'nil'}, error=${
                (error as Error)?.message ?? 'unknown'
              }`,
            );
          }
        }
        if (isFailed && !isDifferentFromAttempted) {
          isDifferentFromAttempted = (() => {
            const prevBundle = Number(prev.jsBundleVersion);
            const remoteBundle = Number(releaseInfo.jsBundleVersion);
            return (
              prev.jsBundleVersion !== null &&
              prev.jsBundleVersion !== undefined &&
              releaseInfo.jsBundleVersion !== null &&
              releaseInfo.jsBundleVersion !== undefined &&
              Number.isFinite(prevBundle) &&
              Number.isFinite(remoteBundle) &&
              remoteBundle !== prevBundle
            );
          })();
        }
        const shouldResetFailed = isFailed && isDifferentFromAttempted;
        // Corrupted/tampered packages must be re-downloaded
        const shouldClearDownloadedEvent =
          shouldResetFailed &&
          (ServiceAppUpdate.VERIFY_FAILED_STATUSES.includes(prev.status) ||
            prev.status === EAppUpdateStatus.failed ||
            prev.status === EAppUpdateStatus.updateIncomplete);

        const shouldTransitionToNotify =
          shouldUpdate && (!isUpdating || shouldResetFailed);
        const nextStatus = shouldTransitionToNotify
          ? EAppUpdateStatus.notify
          : prev.status;

        defaultLogger.app.appUpdate.pendingTaskUpsertDecision({
          traceId,
          requestSeq,
          upsertAction: shouldTransitionToNotify ? 'update' : 'noop',
          reason: shouldTransitionToNotify
            ? 'status_transition_to_notify'
            : 'status_kept',
          decision: shouldUpdate ? 'should_update' : 'no_update',
          prevStatus: prev.status,
          nextStatus,
          prevLatestVersion: prev.latestVersion ?? null,
          nextVersion: releaseInfo.version || prev.latestVersion || null,
          prevBundleVersion: prev.jsBundleVersion ?? null,
          nextBundleVersion:
            releaseInfo.jsBundleVersion || prev.jsBundleVersion || null,
        });

        return {
          ...prev,
          ...releaseInfo,
          // Explicitly clear stale URLs when server no longer returns them
          // (e.g. switch from App Store update to jsBundle update).
          storeUrl: releaseInfo.storeUrl || undefined,
          downloadUrl: releaseInfo.downloadUrl || undefined,
          changeLog: releaseInfo.changeLog || undefined,
          fileSize: releaseInfo.fileSize,
          jsBundleVersion: releaseInfo.jsBundleVersion || undefined,
          jsBundle: releaseInfo.jsBundle || undefined,
          summary: releaseInfo?.summary || '',
          latestVersion: releaseInfo.version || prev.latestVersion,
          updateAt: Date.now(),
          errorText: shouldResetFailed ? undefined : prev.errorText,
          downloadedEvent: shouldClearDownloadedEvent
            ? undefined
            : prev.downloadedEvent,
          status: nextStatus,
          // Always refresh based on current decision — a stale flag from a
          // previous rollback would break first-launch detection for upgrades.
          isRollbackTarget: decision.decision === 'jsBundleRollback',
          previousAppVersion: shouldTransitionToNotify
            ? platformEnv.version
            : prev.previousAppVersion,
        };
      });

      // Auto-trigger silent download for rollback decisions so the user does
      // not need to manually initiate the update.  The download flow will
      // eventually call readyToInstall → syncPendingInstallTask → relaunch.
      if (
        decision.decision === 'jsBundleRollback' &&
        (await appUpdatePersistAtom.get()).status === EAppUpdateStatus.notify
      ) {
        // Verify target is not frozen/ignored before auto-triggering download
        const rollbackTargetKey =
          releaseInfo.version && releaseInfo.jsBundleVersion
            ? this.getTargetKey({
                targetAppVersion: releaseInfo.version,
                targetBundleVersion: releaseInfo.jsBundleVersion,
              })
            : null;
        const rollbackBlocked = rollbackTargetKey
          ? await this.shouldSkipTargetByControl(
              rollbackTargetKey,
              traceId,
              requestSeq,
              false,
            )
          : false;
        if (!rollbackBlocked) {
          // Use setTimeout to avoid blocking the current fetch flow.
          // Re-check status inside the callback: if the UI hook already
          // called downloadPackage(), status will be 'downloadPackage'
          // by now — skip to avoid duplicate concurrent downloads.
          setTimeout(() => {
            void (async () => {
              const current = await appUpdatePersistAtom.get();
              if (current.status !== EAppUpdateStatus.notify) {
                return;
              }
              defaultLogger.app.appUpdate.log(
                'fetchAppUpdateInfo: auto-starting silent download for jsBundleRollback',
              );
              void this.downloadPackage();
            })();
          }, 0);
        }
      }
    } else {
      defaultLogger.app.appUpdate.appUpdateDecisionResolved(
        {
          traceId,
          requestSeq,
          decision: 'invalidRemote',
          reason: 'missing_release_versions',
          allowRollback: true,
          currentAppVersion: platformEnv.version || '',
          currentBundleVersion: String(platformEnv.bundleVersion || ''),
          targetAppVersion: releaseInfo?.version ?? null,
          targetBundleVersion: releaseInfo?.jsBundleVersion ?? null,
          ...this.buildTaskLogFields(null),
        },
        'warn',
      );
    }
    const latest = await appUpdatePersistAtom.get();
    defaultLogger.app.appUpdate.appUpdateFetchResult({
      traceId,
      requestSeq,
      hasReleaseInfo: !!releaseInfo,
      httpStatus: null,
      finalStatus: latest.status,
      latestVersion: latest.latestVersion ?? null,
      latestBundleVersion: latest.jsBundleVersion ?? null,
    });
    return latest;
  }

  // ---- Dev Bundle Switcher ----

  private getDevBundleSwitcherClient = memoizee(
    async () =>
      appApiClient.getBasicClient({
        name: EServiceEndpointEnum.Utility,
        endpoint: buildServiceEndpoint({
          serviceName: EServiceEndpointEnum.Utility,
          env: 'test',
        }),
      }),
    { promise: true },
  );

  @backgroundMethod()
  async devFetchBundleVersions(): Promise<
    { version: string; bundleCount: number }[]
  > {
    try {
      const client = await this.getDevBundleSwitcherClient();
      const response = await client.get<{
        code: number;
        data: { version: string; bundleCount: number }[];
      }>('/utility/v1/app-update/bundle-versions');
      const { code, data } = response.data;
      if (code === 0 && data) {
        defaultLogger.app.jsBundleDev.fetchBundleVersions({
          resultCount: data.length,
          versions: data,
        });
        return data;
      }
      defaultLogger.app.jsBundleDev.fetchBundleVersionsError(
        `Unexpected response code: ${code}`,
      );
      return [];
    } catch (e) {
      defaultLogger.app.jsBundleDev.fetchBundleVersionsError(
        (e as Error)?.message || 'Unknown error',
      );
      return [];
    }
  }

  @backgroundMethod()
  async devFetchBundlesForVersion(version: string): Promise<
    {
      bundleVersion?: string;
      ciBundleVersion: string;
      downloadUrl: string;
      sha256: string;
      signature?: string;
      fileSize: number;
      commitHash?: string;
      branch?: string;
      prTitle?: string;
      changeLog?: string;
      buildNumber?: string;
    }[]
  > {
    try {
      const client = await this.getDevBundleSwitcherClient();
      const response = await client.get<{
        code: number;
        data: {
          bundleVersion?: string;
          ciBundleVersion: string;
          downloadUrl: string;
          sha256: string;
          signature?: string;
          fileSize: number;
          commitHash?: string;
          branch?: string;
          prTitle?: string;
          buildNumber?: string;
        }[];
      }>('/utility/v1/app-update/bundles', {
        params: { version },
      });
      const { code, data } = response.data;
      if (code === 0 && data) {
        defaultLogger.app.jsBundleDev.fetchBundles({
          version,
          resultCount: data.length,
          bundles: data.map((item) => ({
            bundleVersion: item.ciBundleVersion,
            downloadUrl: item.downloadUrl,
            sha256: item.sha256,
            fileSize: item.fileSize,
          })),
        });
        return data.map((item) => ({
          bundleVersion: item.bundleVersion,
          ciBundleVersion: item.ciBundleVersion,
          downloadUrl: item.downloadUrl,
          sha256: item.sha256,
          signature: item.signature || PLACEHOLDER_SIGNATURE,
          fileSize: item.fileSize,
          commitHash: item.commitHash,
          branch: item.branch,
          prTitle: item.prTitle,
          changeLog: item.commitHash
            ? `${item.branch || ''} ${item.commitHash.slice(0, 8)}`.trim()
            : undefined,
          buildNumber: item.buildNumber,
        }));
      }
      defaultLogger.app.jsBundleDev.fetchBundlesError({
        version,
        error: `Unexpected response code: ${code}`,
      });
      return [];
    } catch (e) {
      defaultLogger.app.jsBundleDev.fetchBundlesError({
        version,
        error: (e as Error)?.message || 'Unknown error',
      });
      return [];
    }
  }

  @backgroundMethod()
  async devSearchBundleByCommit(commitHash: string): Promise<
    {
      version: string;
      bundle: {
        bundleVersion?: string;
        ciBundleVersion: string;
        downloadUrl: string;
        sha256: string;
        signature?: string;
        fileSize: number;
        commitHash?: string;
        branch?: string;
        prTitle?: string;
        changeLog?: string;
        buildNumber?: string;
      };
    }[]
  > {
    const needle = commitHash.trim().toLowerCase();
    if (!needle) return [];
    const versions = await this.devFetchBundleVersions();
    const results = await Promise.all(
      versions.map(async (v) => {
        const bundles = await this.devFetchBundlesForVersion(v.version);
        const match = bundles.find((b) =>
          (b.commitHash || '').toLowerCase().startsWith(needle),
        );
        return match ? { version: v.version, bundle: match } : null;
      }),
    );
    return results.filter((r): r is NonNullable<typeof r> => r !== null);
  }
}

export default ServiceAppUpdate;
