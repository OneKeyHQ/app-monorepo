import semver from 'semver';

import { appApiClient } from '@onekeyhq/shared/src/appApiClient/appApiClient';
import type {
  IAppUpdateInstallTaskPayload,
  IJsBundleDownloadSwitchTaskPayload,
  IJsBundleSwitchTaskPayload,
  IPendingInstallTask,
  IResponseAppUpdateInfo,
} from '@onekeyhq/shared/src/appUpdate';
import {
  EAppUpdateStatus,
  EUpdateStrategy,
  gtVersion,
  isFirstLaunchAfterUpdated,
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
import timerUtils from '@onekeyhq/shared/src/utils/timerUtils';
import { EServiceEndpointEnum } from '@onekeyhq/shared/types/endpoint';

import { appUpdatePersistAtom } from '../states/jotai/atoms';

import {
  clearPendingInstallTask,
  getPendingInstallTask,
  setPendingInstallTask,
} from './pendingInstallTaskStorage';
import ServiceBase from './ServiceBase';

let syncTimerId: ReturnType<typeof setTimeout>;
let downloadTimeoutId: ReturnType<typeof setTimeout>;
let failedRecoveryTimerId: ReturnType<typeof setTimeout>;
let firstLaunch = true;
const PLACEHOLDER_SIGNATURE = 'dev-no-signature';
const MAX_TASK_RETRY = 3;
const MAX_RETRY_DELAY_MS = 10 * 60 * 1000;
const RETRY_BASE_DELAY_MS = 30 * 1000;
const RETRY_JITTER_MS = 5 * 1000;
const TASK_FUSE_DURATION_MS = 24 * 60 * 60 * 1000;

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

  private isValidTaskBase(task: unknown): task is IPendingInstallTask {
    if (!task || typeof task !== 'object') {
      return false;
    }
    const t = task as IPendingInstallTask;
    if (
      !t.taskId ||
      !t.type ||
      !t.requiredAppVersion ||
      !Number.isFinite(t.createdAt) ||
      !Number.isFinite(t.expiresAt) ||
      !Number.isFinite(t.retryCount)
    ) {
      return false;
    }
    if (!['pending', 'running', 'failed'].includes(t.status)) {
      return false;
    }
    if (!t.payload || typeof t.payload !== 'object') {
      return false;
    }
    return true;
  }

  private isValidJsBundleSwitchPayload(payload: unknown) {
    const p = payload as IJsBundleSwitchTaskPayload;
    return !!(p?.appVersion && p.bundleVersion && p.signature);
  }

  private isValidJsBundleDownloadSwitchPayload(payload: unknown) {
    const p = payload as IJsBundleDownloadSwitchTaskPayload;
    return (
      this.isValidJsBundleSwitchPayload(payload) &&
      !!p.downloadUrl &&
      p.downloadUrl.startsWith('https://') &&
      Number.isFinite(p.fileSize) &&
      p.fileSize > 0 &&
      !!p.sha256
    );
  }

  private isValidAppUpdateInstallPayload(payload: unknown) {
    const p = payload as IAppUpdateInstallTaskPayload;
    if (!p?.latestVersion) {
      return false;
    }
    if (
      ![
        EUpdateStrategy.silent,
        EUpdateStrategy.force,
        EUpdateStrategy.manual,
        EUpdateStrategy.seamless,
      ].includes(p.updateStrategy)
    ) {
      return false;
    }
    if (p.channel === 'store') {
      return !!p.storeUrl;
    }
    if (p.channel === 'direct') {
      if (!p.downloadUrl) {
        return false;
      }
      if (p.updateStrategy === EUpdateStrategy.silent) {
        return !!p.fileSize && !!p.sha256 && !!p.signature;
      }
      return true;
    }
    return false;
  }

  private isValidPendingInstallTask(
    task: unknown,
  ): task is IPendingInstallTask {
    if (!this.isValidTaskBase(task)) {
      return false;
    }
    if (task.type === 'jsbundle-switch') {
      return this.isValidJsBundleSwitchPayload(task.payload);
    }
    if (task.type === 'jsbundle-download-switch') {
      return this.isValidJsBundleDownloadSwitchPayload(task.payload);
    }
    if (task.type === 'appupdate-install') {
      return this.isValidAppUpdateInstallPayload(task.payload);
    }
    return false;
  }

  private getRetryDelayMs(retryCount: number) {
    const expDelay = RETRY_BASE_DELAY_MS * 2 ** retryCount;
    const baseDelay = Math.min(MAX_RETRY_DELAY_MS, expDelay);
    const jitter = Math.floor(Math.random() * (RETRY_JITTER_MS + 1));
    return baseDelay + jitter;
  }

  private isCurrentAppVersion(version?: string) {
    if (
      !version ||
      !semver.valid(version) ||
      !semver.valid(platformEnv.version)
    ) {
      return false;
    }
    return semver.eq(version, platformEnv.version);
  }

  private shouldUpdateFromReleaseInfo(releaseInfo: IResponseAppUpdateInfo) {
    if (
      this.isCurrentAppVersion(releaseInfo.version) &&
      releaseInfo.jsBundleVersion
    ) {
      return (
        Number(releaseInfo.jsBundleVersion) !==
        Number(platformEnv.bundleVersion)
      );
    }
    try {
      return gtVersion(releaseInfo.version, releaseInfo.jsBundleVersion);
    } catch (error) {
      defaultLogger.app.appUpdate.log(
        `shouldUpdateFromReleaseInfo: invalid version payload, version=${
          releaseInfo.version ?? 'nil'
        }, jsBundleVersion=${releaseInfo.jsBundleVersion ?? 'nil'}, error=${
          (error as Error)?.message ?? 'unknown'
        }`,
      );
      return false;
    }
  }

  private buildPendingJsBundleTask(
    releaseInfo: IResponseAppUpdateInfo,
  ): IPendingInstallTask | undefined {
    const appVersion = releaseInfo.version;
    const bundleVersion = releaseInfo.jsBundleVersion;
    const downloadUrl = releaseInfo.jsBundle?.downloadUrl;
    const fileSize = releaseInfo.jsBundle?.fileSize ?? releaseInfo.fileSize;
    const sha256 = releaseInfo.jsBundle?.sha256;
    if (!appVersion || !bundleVersion || !downloadUrl || !sha256) {
      return undefined;
    }

    const now = Date.now();
    return {
      taskId: `jsbundle:${appVersion}:${bundleVersion}`,
      type: 'jsbundle-download-switch',
      requiredAppVersion: appVersion,
      createdAt: now,
      expiresAt: now + timerUtils.getTimeDurationMs({ day: 7 }),
      retryCount: 0,
      status: 'pending',
      payload: {
        appVersion,
        bundleVersion,
        downloadUrl,
        fileSize: Number(fileSize),
        sha256,
        signature: releaseInfo.jsBundle?.signature ?? PLACEHOLDER_SIGNATURE,
      },
    };
  }

  private async syncPendingInstallTaskWithReleaseInfo(
    releaseInfo: IResponseAppUpdateInfo | undefined,
  ) {
    if (!releaseInfo || !this.isCurrentAppVersion(releaseInfo.version)) {
      await clearPendingInstallTask();
      return;
    }

    if (
      !releaseInfo.jsBundleVersion ||
      Number(releaseInfo.jsBundleVersion) === Number(platformEnv.bundleVersion)
    ) {
      await clearPendingInstallTask();
      return;
    }

    const task = this.buildPendingJsBundleTask(releaseInfo);
    if (!task || !this.isValidPendingInstallTask(task)) {
      defaultLogger.app.appUpdate.log(
        'syncPendingInstallTaskWithReleaseInfo: invalid task payload ignored',
      );
      await clearPendingInstallTask();
      return;
    }
    await setPendingInstallTask(task);
  }

  private async markTaskFailed(task: IPendingInstallTask, message: string) {
    const nextRetryCount = task.retryCount + 1;
    const now = Date.now();
    if (nextRetryCount >= MAX_TASK_RETRY) {
      await setPendingInstallTask({
        ...task,
        retryCount: nextRetryCount,
        status: 'failed',
        runningStartedAt: undefined,
        lastError: message,
        nextRetryAt: now + TASK_FUSE_DURATION_MS,
      });
      return;
    }

    const delayMs = this.getRetryDelayMs(nextRetryCount);
    await setPendingInstallTask({
      ...task,
      retryCount: nextRetryCount,
      status: 'pending',
      runningStartedAt: undefined,
      lastError: message,
      nextRetryAt: now + delayMs,
    });
  }

  private async executeBundleSwitchTask(
    task: IPendingInstallTask,
    allowDownload: boolean,
  ) {
    const payload = task.payload as
      | IJsBundleSwitchTaskPayload
      | IJsBundleDownloadSwitchTaskPayload;
    const { appVersion, bundleVersion, signature } = payload;
    const bundleExists = await BundleUpdate.isBundleExists(
      appVersion,
      bundleVersion,
    );

    if (bundleExists) {
      try {
        await BundleUpdate.verifyExtractedBundle(appVersion, bundleVersion);
        await BundleUpdate.switchBundle({
          appVersion,
          bundleVersion,
          signature,
        });
        return;
      } catch (error) {
        await BundleUpdate.clearBundle();
        if (!allowDownload) {
          throw error;
        }
      }
    }

    if (!allowDownload) {
      throw new OneKeyLocalError(
        `Bundle not found for switch task ${appVersion}-${bundleVersion}`,
      );
    }

    const downloadPayload = payload as IJsBundleDownloadSwitchTaskPayload;
    const downloadedEvent = await BundleUpdate.downloadBundle({
      latestVersion: downloadPayload.appVersion,
      bundleVersion: downloadPayload.bundleVersion,
      downloadUrl: downloadPayload.downloadUrl,
      fileSize: downloadPayload.fileSize,
      sha256: downloadPayload.sha256,
      signature: downloadPayload.signature,
    });
    await BundleUpdate.downloadBundleASC(downloadedEvent);
    await BundleUpdate.verifyBundleASC(downloadedEvent);
    await BundleUpdate.verifyBundle(downloadedEvent);
    await BundleUpdate.verifyExtractedBundle(appVersion, bundleVersion);
    await BundleUpdate.switchBundle({
      appVersion,
      bundleVersion,
      signature,
    });
  }

  private async executeAppUpdateInstallTask(task: IPendingInstallTask) {
    const payload = task.payload as IAppUpdateInstallTaskPayload;
    if (payload.channel === 'store') {
      return;
    }
    const downloadedEvent = await AppUpdate.downloadPackage({
      latestVersion: payload.latestVersion,
      downloadUrl: payload.downloadUrl,
      fileSize: payload.fileSize,
      sha256: payload.sha256,
      signature: payload.signature,
    });
    await AppUpdate.downloadASC(downloadedEvent);
    await AppUpdate.verifyASC(downloadedEvent);
    await AppUpdate.verifyPackage(downloadedEvent);
    const appInfo = await appUpdatePersistAtom.get();
    await AppUpdate.installPackage({
      ...appInfo,
      latestVersion: payload.latestVersion,
      updateStrategy: payload.updateStrategy,
      downloadUrl: payload.downloadUrl,
      fileSize: payload.fileSize,
      status: EAppUpdateStatus.ready,
    });
  }

  private async executePendingInstallTask(task: IPendingInstallTask) {
    if (task.type === 'jsbundle-switch') {
      await this.executeBundleSwitchTask(task, false);
      return;
    }
    if (task.type === 'jsbundle-download-switch') {
      await this.executeBundleSwitchTask(task, true);
      return;
    }
    await this.executeAppUpdateInstallTask(task);
  }

  private startFailedRecoveryTimer() {
    clearTimeout(failedRecoveryTimerId);
    failedRecoveryTimerId = setTimeout(
      async () => {
        const appInfo = await appUpdatePersistAtom.get();
        defaultLogger.app.appUpdate.log(
          `Failed recovery timer fired, current status: ${appInfo.status}`,
        );
        if (ServiceAppUpdate.FAILED_STATUSES.includes(appInfo.status)) {
          const isVerifyFailure =
            ServiceAppUpdate.VERIFY_FAILED_STATUSES.includes(appInfo.status);
          await appUpdatePersistAtom.set((prev) => ({
            ...prev,
            errorText: undefined,
            status: EAppUpdateStatus.notify,
            downloadedEvent: isVerifyFailure ? undefined : prev.downloadedEvent,
          }));
        }
      },
      timerUtils.getTimeDurationMs({ hour: 2 }),
    );
  }

  @backgroundMethod()
  async processPendingInstallTask() {
    let task = await getPendingInstallTask();
    if (!task) {
      return;
    }

    const now = Date.now();
    if (task.status === 'running') {
      const recoveredRetry = task.retryCount + 1;
      if (recoveredRetry >= MAX_TASK_RETRY) {
        await setPendingInstallTask({
          ...task,
          retryCount: recoveredRetry,
          status: 'failed',
          runningStartedAt: undefined,
          lastError: 'interrupted',
          nextRetryAt: now + TASK_FUSE_DURATION_MS,
        });
        return;
      }
      task = {
        ...task,
        status: 'pending',
        retryCount: recoveredRetry,
        runningStartedAt: undefined,
        lastError: 'interrupted',
      };
      await setPendingInstallTask(task);
    }

    if (task.status === 'failed') {
      return;
    }
    if (!this.isValidPendingInstallTask(task)) {
      await clearPendingInstallTask();
      return;
    }
    if (task.requiredAppVersion !== platformEnv.version) {
      await clearPendingInstallTask();
      return;
    }
    if (task.expiresAt <= now) {
      await clearPendingInstallTask();
      return;
    }
    if (task.nextRetryAt && task.nextRetryAt > now) {
      return;
    }

    const runningTask: IPendingInstallTask = {
      ...task,
      status: 'running',
      runningStartedAt: now,
    };
    await setPendingInstallTask(runningTask);

    try {
      await this.executePendingInstallTask(runningTask);
      await clearPendingInstallTask();
    } catch (error) {
      const message = (error as Error)?.message ?? 'unknown';
      await this.markTaskFailed(runningTask, message);
    }
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
  ];

  static VERIFY_FAILED_STATUSES: EAppUpdateStatus[] = [
    EAppUpdateStatus.verifyASCFailed,
    EAppUpdateStatus.verifyPackageFailed,
  ];

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
      // On app launch / foreground, reset failed states back to notify
      // so the user gets a fresh update prompt instead of a stale error.
      defaultLogger.app.appUpdate.log(
        `refreshUpdateStatus: resetting failed status ${appInfo.status} to notify`,
      );
      const isVerifyFailure = ServiceAppUpdate.VERIFY_FAILED_STATUSES.includes(
        appInfo.status,
      );
      await appUpdatePersistAtom.set((prev) => ({
        ...prev,
        errorText: undefined,
        status: EAppUpdateStatus.notify,
        // Corrupted/tampered packages must be re-downloaded
        downloadedEvent: isVerifyFailure ? undefined : prev.downloadedEvent,
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
    const { status } = await appUpdatePersistAtom.get();
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
    await BundleUpdate.clearBundle();
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
    await this.refreshUpdateStatus();
    // downloading app or ready to update via local package
    const isNeedSync = await this.isNeedSyncAppUpdateInfo(forceUpdate);
    defaultLogger.app.appUpdate.isNeedSyncAppUpdateInfo(isNeedSync);
    if (!isNeedSync) {
      defaultLogger.app.appUpdate.log(
        `fetchAppUpdateInfo: skip sync, forceUpdate=${String(forceUpdate)}`,
      );
      return appUpdatePersistAtom.get();
    }

    const releaseInfo = await this.getAppLatestInfo(forceUpdate);
    defaultLogger.app.appUpdate.fetchConfig(releaseInfo);
    await this.syncPendingInstallTaskWithReleaseInfo(releaseInfo);

    if (releaseInfo?.version || releaseInfo?.jsBundleVersion) {
      defaultLogger.app.appUpdate.log(
        `fetchAppUpdateInfo: releaseInfo matched, version=${
          releaseInfo.version ?? 'nil'
        }, jsBundleVersion=${releaseInfo.jsBundleVersion ?? 'nil'}, hasStoreUrl=${!!releaseInfo.storeUrl}, hasDownloadUrl=${!!releaseInfo.downloadUrl}, hasJsBundleDownloadUrl=${!!releaseInfo
          .jsBundle?.downloadUrl}`,
      );
      const shouldUpdate = this.shouldUpdateFromReleaseInfo(releaseInfo);
      defaultLogger.app.appUpdate.log(
        `fetchAppUpdateInfo: shouldUpdate=${String(shouldUpdate)}`,
      );
      await appUpdatePersistAtom.set((prev) => {
        const isUpdating = prev.status !== EAppUpdateStatus.done;

        // Check if the current state is a failed state and the server has
        // a newer version than the one we were trying to update to.
        // In that case, reset to notify so the user gets the new version
        // instead of retrying a stale download.
        const failedStatuses: EAppUpdateStatus[] = [
          EAppUpdateStatus.downloadPackageFailed,
          EAppUpdateStatus.downloadASCFailed,
          EAppUpdateStatus.verifyASCFailed,
          EAppUpdateStatus.verifyPackageFailed,
        ];
        const isFailed = failedStatuses.includes(prev.status);
        let isNewerThanAttempted = false;
        if (isFailed && releaseInfo.version && prev.latestVersion) {
          try {
            isNewerThanAttempted = semver.gt(
              releaseInfo.version,
              prev.latestVersion,
            );
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
        if (
          isFailed &&
          !isNewerThanAttempted &&
          releaseInfo.jsBundleVersion &&
          prev.jsBundleVersion
        ) {
          isNewerThanAttempted =
            Number(releaseInfo.jsBundleVersion) !==
            Number(prev.jsBundleVersion);
        }
        const shouldResetFailed = isFailed && isNewerThanAttempted;
        // Corrupted/tampered packages must be re-downloaded
        const isVerifyFailure =
          shouldResetFailed &&
          ServiceAppUpdate.VERIFY_FAILED_STATUSES.includes(prev.status);

        const shouldTransitionToNotify =
          shouldUpdate && (!isUpdating || shouldResetFailed);
        const nextStatus = shouldTransitionToNotify
          ? EAppUpdateStatus.notify
          : prev.status;

        defaultLogger.app.appUpdate.log(
          `fetchAppUpdateInfo: transition decision, prevStatus=${
            prev.status
          }, nextStatus=${nextStatus}, isUpdating=${String(
            isUpdating,
          )}, isFailed=${String(isFailed)}, isNewerThanAttempted=${String(
            isNewerThanAttempted,
          )}, shouldResetFailed=${String(
            shouldResetFailed,
          )}, isVerifyFailure=${String(
            isVerifyFailure,
          )}, shouldTransitionToNotify=${String(
            shouldTransitionToNotify,
          )}, prevLatestVersion=${prev.latestVersion ?? 'nil'}, nextVersion=${
            releaseInfo.version || prev.latestVersion || 'nil'
          }, prevBundleVersion=${
            prev.jsBundleVersion ?? 'nil'
          }, nextBundleVersion=${
            releaseInfo.jsBundleVersion || prev.jsBundleVersion || 'nil'
          }`,
        );

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
          downloadedEvent: isVerifyFailure ? undefined : prev.downloadedEvent,
          status: nextStatus,
          previousAppVersion: shouldTransitionToNotify
            ? platformEnv.version
            : prev.previousAppVersion,
        };
      });
    } else {
      defaultLogger.app.appUpdate.log(
        `fetchAppUpdateInfo: releaseInfo missing version and jsBundleVersion, reset()`,
      );
      await this.reset();
    }
    const latest = await appUpdatePersistAtom.get();
    defaultLogger.app.appUpdate.log(
      `fetchAppUpdateInfo: completed, status=${
        latest.status
      }, latestVersion=${latest.latestVersion ?? 'nil'}, jsBundleVersion=${
        latest.jsBundleVersion ?? 'nil'
      }, hasStoreUrl=${!!latest.storeUrl}, hasDownloadUrl=${!!latest.downloadUrl}, hasJsBundleDownloadUrl=${!!latest.jsBundle?.downloadUrl}`,
    );
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
      bundleVersion: string;
      downloadUrl: string;
      sha256: string;
      signature?: string;
      fileSize: number;
      commitHash?: string;
      changeLog?: string;
    }[]
  > {
    try {
      const client = await this.getDevBundleSwitcherClient();
      const response = await client.get<{
        code: number;
        data: {
          bundleVersion: string;
          downloadUrl: string;
          sha256: string;
          signature?: string;
          fileSize: number;
          commitHash?: string;
          branch?: string;
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
            bundleVersion: item.bundleVersion,
            downloadUrl: item.downloadUrl,
            sha256: item.sha256,
            fileSize: item.fileSize,
          })),
        });
        return data.map((item) => ({
          bundleVersion: item.bundleVersion,
          downloadUrl: item.downloadUrl,
          sha256: item.sha256,
          signature: item.signature || PLACEHOLDER_SIGNATURE,
          fileSize: item.fileSize,
          commitHash: item.commitHash,
          changeLog: item.commitHash
            ? `${item.branch || ''} ${item.commitHash.slice(0, 8)}`.trim()
            : undefined,
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
}

export default ServiceAppUpdate;
