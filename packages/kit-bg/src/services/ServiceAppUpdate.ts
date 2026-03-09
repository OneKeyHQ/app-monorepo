import semver from 'semver';

import { appApiClient } from '@onekeyhq/shared/src/appApiClient/appApiClient';
import type { IResponseAppUpdateInfo } from '@onekeyhq/shared/src/appUpdate';
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

import ServiceBase from './ServiceBase';

let syncTimerId: ReturnType<typeof setTimeout>;
let downloadTimeoutId: ReturnType<typeof setTimeout>;
let failedRecoveryTimerId: ReturnType<typeof setTimeout>;
let firstLaunch = true;
const PLACEHOLDER_SIGNATURE = 'dev-no-signature';
@backgroundClass()
class ServiceAppUpdate extends ServiceBase {
  constructor({ backgroundApi }: { backgroundApi: any }) {
    super({ backgroundApi });
  }

  private isResetting = false;

  private updateAt = 0;

  cachedUpdateInfo: IResponseAppUpdateInfo | undefined;

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
  async fetchConfig() {
    const client = await this.getClient(EServiceEndpointEnum.Utility);
    const response = await client.get<{
      code: number;
      data: IResponseAppUpdateInfo;
    }>('/utility/v1/app-update');
    const { code, data } = response.data;
    if (code === 0 && data) {
      // Security: Validate updateStrategy is a known enum value
      if (
        data.updateStrategy !== undefined &&
        ![
          EUpdateStrategy.silent,
          EUpdateStrategy.force,
          EUpdateStrategy.manual,
          EUpdateStrategy.seamless,
        ].includes(data.updateStrategy)
      ) {
        defaultLogger.app.appUpdate.endInstallPackage(
          false,
          new Error(
            `Invalid updateStrategy value: ${String(data.updateStrategy)}`,
          ),
        );
        return this.cachedUpdateInfo;
      }
      // Security: Validate jsBundle fields if present
      if (data.jsBundle) {
        if (
          data.jsBundle.downloadUrl &&
          !data.jsBundle.downloadUrl.startsWith('https://')
        ) {
          defaultLogger.app.appUpdate.endInstallPackage(
            false,
            new Error('jsBundle downloadUrl must use HTTPS'),
          );
          return this.cachedUpdateInfo;
        }
      }
      this.updateAt = Date.now();
      this.cachedUpdateInfo = data;
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
      return appUpdatePersistAtom.get();
    }

    const releaseInfo = await this.getAppLatestInfo(forceUpdate);
    defaultLogger.app.appUpdate.fetchConfig(releaseInfo);
    if (releaseInfo?.version || releaseInfo?.jsBundleVersion) {
      const shouldUpdate = gtVersion(
        releaseInfo.version,
        releaseInfo.jsBundleVersion,
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
          } catch {
            // invalid semver — fall through
          }
        }
        if (
          isFailed &&
          !isNewerThanAttempted &&
          releaseInfo.jsBundleVersion &&
          prev.jsBundleVersion
        ) {
          isNewerThanAttempted =
            Number(releaseInfo.jsBundleVersion) > Number(prev.jsBundleVersion);
        }
        const shouldResetFailed = isFailed && isNewerThanAttempted;
        // Corrupted/tampered packages must be re-downloaded
        const isVerifyFailure =
          shouldResetFailed &&
          ServiceAppUpdate.VERIFY_FAILED_STATUSES.includes(prev.status);

        const shouldTransitionToNotify =
          shouldUpdate && (!isUpdating || shouldResetFailed);

        return {
          ...prev,
          ...releaseInfo,
          jsBundleVersion: releaseInfo.jsBundleVersion || undefined,
          jsBundle: releaseInfo.jsBundle || undefined,
          summary: releaseInfo?.summary || '',
          latestVersion: releaseInfo.version || prev.latestVersion,
          updateAt: Date.now(),
          errorText: shouldResetFailed ? undefined : prev.errorText,
          downloadedEvent: isVerifyFailure ? undefined : prev.downloadedEvent,
          status: shouldTransitionToNotify
            ? EAppUpdateStatus.notify
            : prev.status,
          previousAppVersion: shouldTransitionToNotify
            ? platformEnv.version
            : prev.previousAppVersion,
        };
      });
    } else {
      await this.reset();
    }
    return appUpdatePersistAtom.get();
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
