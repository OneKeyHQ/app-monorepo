import type { IResponseAppUpdateInfo } from '@onekeyhq/shared/src/appUpdate';
import {
  EAppUpdateStatus,
  isFirstLaunchAfterUpdated,
} from '@onekeyhq/shared/src/appUpdate';
import {
  backgroundClass,
  backgroundMethod,
} from '@onekeyhq/shared/src/background/backgroundDecorators';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import {
  type IUpdateDownloadedEvent,
  clearPackage,
} from '@onekeyhq/shared/src/modules3rdParty/auto-update';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import timerUtils from '@onekeyhq/shared/src/utils/timerUtils';
import { EServiceEndpointEnum } from '@onekeyhq/shared/types/endpoint';

import { appUpdatePersistAtom } from '../states/jotai/atoms';

import ServiceBase from './ServiceBase';

let extensionSyncTimerId: ReturnType<typeof setTimeout>;
let downloadTimeoutId: ReturnType<typeof setTimeout>;
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
        isForceUpdate: false,
        errorText: undefined,
        status: EAppUpdateStatus.done,
      }));
    }
  }

  @backgroundMethod()
  async isNeedSyncAppUpdateInfo() {
    const { status, updateAt } = await appUpdatePersistAtom.get();
    if (platformEnv.isExtension) {
      clearTimeout(extensionSyncTimerId);
      // add random time to avoid all extension request at the same time.
      const timeout =
        timerUtils.getTimeDurationMs({
          hour: 1,
        }) +
        timerUtils.getTimeDurationMs({
          minute: 5,
        }) *
          Math.random();
      extensionSyncTimerId = setTimeout(() => {
        void this.fetchAppUpdateInfo();
      }, timeout);
      return (
        Date.now() - updateAt >
        timerUtils.getTimeDurationMs({
          day: 1,
        })
      );
    }
    return ![EAppUpdateStatus.downloadPackage, EAppUpdateStatus.ready].includes(
      status,
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
    clearTimeout(extensionSyncTimerId);
    clearTimeout(downloadTimeoutId);
    await appUpdatePersistAtom.set({
      latestVersion: '0.0.0',
      isForceUpdate: false,
      updateAt: 0,
      summary: '',
      status: EAppUpdateStatus.done,
      isShowUpdateDialog: false,
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
  public async clearCache() {
    clearTimeout(downloadTimeoutId);
    await clearPackage();
    await this.reset();
  }

  @backgroundMethod()
  public async fetchChangeLog() {
    const response = await this.getAppLatestInfo();
    return {
      changeLog: response?.changeLog,
      summary: response?.summary,
    };
  }

  @backgroundMethod()
  public async fetchAppUpdateInfo(forceUpdate = false) {
    await this.refreshUpdateStatus();
    // downloading app or ready to update via local package
    if (!(await this.isNeedSyncAppUpdateInfo())) {
      return;
    }

    const releaseInfo = await this.getAppLatestInfo(forceUpdate);
    if (releaseInfo?.version) {
      await appUpdatePersistAtom.set((prev) => ({
        ...prev,
        ...releaseInfo,
        summary: releaseInfo?.summary || '',
        latestVersion: releaseInfo.version || prev.latestVersion,
        updateAt: Date.now(),
        status:
          releaseInfo?.version && releaseInfo.version !== prev.latestVersion
            ? EAppUpdateStatus.notify
            : prev.status,
        isShowUpdateDialog: platformEnv.version !== releaseInfo.version,
      }));
    } else {
      await this.reset();
    }
    return appUpdatePersistAtom.get();
  }
}

export default ServiceAppUpdate;
