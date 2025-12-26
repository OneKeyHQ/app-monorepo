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
let firstLaunch = true;
@backgroundClass()
class ServiceAppUpdate extends ServiceBase {
  constructor({ backgroundApi }: { backgroundApi: any }) {
    super({ backgroundApi });
  }

  private updateAt = 0;

  cachedUpdateInfo: IResponseAppUpdateInfo | undefined;

  @backgroundMethod()
  async fetchConfig() {
    const client = await this.getClient(EServiceEndpointEnum.Utility);
    const response = await client.get<{
      code: number;
      data: IResponseAppUpdateInfo;
    }>('/utility/v1/app-update');
    const { code, data } = response.data;
    if (code === 0) {
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

  @backgroundMethod()
  async refreshUpdateStatus() {
    const appInfo = await appUpdatePersistAtom.get();
    if (isFirstLaunchAfterUpdated(appInfo)) {
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
    }
  }

  @backgroundMethod()
  async isNeedSyncAppUpdateInfo(forceUpdate = false) {
    const { status, updateAt } = await appUpdatePersistAtom.get();
    clearTimeout(syncTimerId);
    if (
      status === EAppUpdateStatus.downloadPackage ||
      status === EAppUpdateStatus.ready
    ) {
      return false;
    }

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

  @backgroundMethod()
  public async downloadPackage() {
    clearTimeout(downloadTimeoutId);
    downloadTimeoutId = setTimeout(async () => {
      await this.downloadPackageFailed({
        message: ETranslations.update_download_timed_out_check_connection,
      });
    }, timerUtils.getTimeDurationMs({ minute: 30 }));
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
    clearTimeout(downloadTimeoutId);
    await appUpdatePersistAtom.set((prev) => ({
      ...prev,
      status: EAppUpdateStatus.verifyPackage,
    }));
  }

  @backgroundMethod()
  public async verifyASC() {
    await appUpdatePersistAtom.set((prev) => ({
      ...prev,
      status: EAppUpdateStatus.verifyASC,
    }));
  }

  @backgroundMethod()
  public async downloadASC() {
    await appUpdatePersistAtom.set((prev) => ({
      ...prev,
      status: EAppUpdateStatus.downloadASC,
    }));
  }

  @backgroundMethod()
  public async verifyASCFailed(e?: { message: string }) {
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
  }

  @backgroundMethod()
  public async verifyPackageFailed(e?: { message: string }) {
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
  }

  @backgroundMethod()
  public async downloadASCFailed(e?: { message: string }) {
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
  }

  @backgroundMethod()
  public async readyToInstall() {
    clearTimeout(downloadTimeoutId);
    await appUpdatePersistAtom.set((prev) => ({
      ...prev,
      status: EAppUpdateStatus.ready,
    }));
  }

  @backgroundMethod()
  public async reset() {
    clearTimeout(syncTimerId);
    clearTimeout(downloadTimeoutId);
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
        return {
          ...prev,
          ...releaseInfo,
          jsBundleVersion: releaseInfo.jsBundleVersion || undefined,
          jsBundle: releaseInfo.jsBundle || undefined,
          summary: releaseInfo?.summary || '',
          latestVersion: releaseInfo.version || prev.latestVersion,
          updateAt: Date.now(),
          status:
            shouldUpdate && !isUpdating ? EAppUpdateStatus.notify : prev.status,
          previousAppVersion:
            shouldUpdate && !isUpdating
              ? platformEnv.version
              : prev.previousAppVersion,
        };
      });
    } else {
      await this.reset();
    }
    return appUpdatePersistAtom.get();
  }
}

export default ServiceAppUpdate;
