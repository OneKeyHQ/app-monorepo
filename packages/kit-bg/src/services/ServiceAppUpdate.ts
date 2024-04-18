import axios from 'axios';

import {
  EAppUpdateStatus,
  type IAppUpdateInfoData,
  getChangeLog,
  handleReleaseInfo,
  isFirstLaunchAfterUpdated,
} from '@onekeyhq/shared/src/appUpdate';
import {
  backgroundClass,
  backgroundMethod,
} from '@onekeyhq/shared/src/background/backgroundDecorators';
import {
  ONEKEY_APP_TEST_UPDATE_URL,
  ONEKEY_APP_UPDATE_URL,
} from '@onekeyhq/shared/src/config/appConfig';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import timerUtils from '@onekeyhq/shared/src/utils/timerUtils';

import {
  appUpdatePersistAtom,
  devSettingsPersistAtom,
} from '../states/jotai/atoms';

import ServiceBase from './ServiceBase';

const AxiosInstance = axios.create();

let extensionSyncTimerId: ReturnType<typeof setTimeout>;
let downloadTimeoutId: ReturnType<typeof setTimeout>;
@backgroundClass()
class ServiceAppUpdate extends ServiceBase {
  constructor({ backgroundApi }: { backgroundApi: any }) {
    super({ backgroundApi });
  }

  cachedUpdateInfo: IAppUpdateInfoData | undefined;

  @backgroundMethod()
  async getEndpoints() {
    const settings = await devSettingsPersistAtom.get();
    const url =
      settings.enabled && settings.settings?.enableTestEndpoint
        ? ONEKEY_APP_TEST_UPDATE_URL
        : ONEKEY_APP_UPDATE_URL;

    const key = Math.random().toString();
    return `${url}?&nocache=${key}`;
  }

  @backgroundMethod()
  async fetchConfig() {
    const url = await this.getEndpoints();
    const response = await AxiosInstance.get<IAppUpdateInfoData>(url);
    this.cachedUpdateInfo = response.data;
    return response.data;
  }

  @backgroundMethod()
  async getAppLatestInfo({ cached = true }: { cached?: boolean } = {}) {
    if (cached && this.cachedUpdateInfo) {
      void this.fetchConfig();
      return this.cachedUpdateInfo;
    }
    return this.fetchConfig();
  }

  @backgroundMethod()
  async refreshUpdateStatus() {
    const appInfo = await appUpdatePersistAtom.get();
    if (isFirstLaunchAfterUpdated(appInfo)) {
      await appUpdatePersistAtom.set((prev) => ({
        ...prev,
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
    return ![EAppUpdateStatus.downloading, EAppUpdateStatus.ready].includes(
      status,
    );
  }

  @backgroundMethod()
  public async startDownloading() {
    clearTimeout(downloadTimeoutId);
    downloadTimeoutId = setTimeout(async () => {
      await this.notifyFailed({
        message: 'Download timed out, please check your internet connection.',
      });
    }, timerUtils.getTimeDurationMs({ minute: 5 }));
    await appUpdatePersistAtom.set((prev) => ({
      ...prev,
      status: EAppUpdateStatus.downloading,
    }));
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
    await appUpdatePersistAtom.set({
      latestVersion: process.env.VERSION ?? '1.0.0',
      isForceUpdate: false,
      updateAt: 0,
      status: EAppUpdateStatus.done,
    });
  }

  @backgroundMethod()
  public async notifyFailed(e?: { message: string }) {
    clearTimeout(downloadTimeoutId);
    let errorText =
      e?.message || 'Network exception, please check your internet connection.';

    if (errorText.includes('Server not responding')) {
      errorText = 'Server not responding, please try again later.';
    } else if (errorText.includes('Software caused connection abort')) {
      errorText = 'Network instability, please check your internet connection.';
    }
    void appUpdatePersistAtom.set((prev) => ({
      ...prev,
      errorText,
      status: EAppUpdateStatus.failed,
    }));
  }

  @backgroundMethod()
  public async fetchChangeLog(version: string) {
    const response = await this.getAppLatestInfo({ cached: true });
    return getChangeLog(version, response.changelog);
  }

  @backgroundMethod()
  public async fetchAppUpdateInfo() {
    await this.refreshUpdateStatus();
    // downloading app or ready to update via local package
    if (!(await this.isNeedSyncAppUpdateInfo())) {
      return;
    }

    const data = await this.getAppLatestInfo();
    const releaseInfo = handleReleaseInfo(data);
    await appUpdatePersistAtom.set((prev) => ({
      ...prev,
      ...releaseInfo,
      updateAt: Date.now(),
      status:
        releaseInfo.latestVersion &&
        releaseInfo.latestVersion !== prev.latestVersion
          ? EAppUpdateStatus.notify
          : prev.status,
    }));
  }
}

export default ServiceAppUpdate;
