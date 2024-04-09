import axios from 'axios';

import {
  EAppUpdateStatus,
  type IAppUpdateInfoData,
  handleReleaseInfo,
  isFirstLaunchAfterUpdated,
} from '@onekeyhq/shared/src/appUpdate';
import {
  backgroundClass,
  backgroundMethod,
} from '@onekeyhq/shared/src/background/backgroundDecorators';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { appUpdatePersistAtom } from '../states/jotai/atoms';

import ServiceBase from './ServiceBase';

const AxiosInstance = axios.create();

let timerId: ReturnType<typeof setTimeout>;
@backgroundClass()
class ServiceAppUpdate extends ServiceBase {
  constructor({ backgroundApi }: { backgroundApi: any }) {
    super({ backgroundApi });
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
      clearTimeout(timerId);
      timerId = setTimeout(() => {
        void this.fetchAppUpdateInfo();
        // add random time to avoid all extension request at the same time.
      }, 1000 * 60 * 60 + Math.random() * 1000 * 60 * 5);
      return Date.now() - updateAt < 1000 * 60 * 60 * 24;
    }
    return ![EAppUpdateStatus.downloading, EAppUpdateStatus.ready].includes(
      status,
    );
  }

  @backgroundMethod()
  public async startDownloading() {
    await appUpdatePersistAtom.set((prev) => ({
      ...prev,
      status: EAppUpdateStatus.downloading,
    }));
  }

  @backgroundMethod()
  public async readToInstall() {
    await appUpdatePersistAtom.set((prev) => ({
      ...prev,
      status: EAppUpdateStatus.ready,
    }));
  }

  @backgroundMethod()
  public async fetchAppUpdateInfo() {
    await this.refreshUpdateStatus();
    // downloading app or ready to update via local package
    if (!(await this.isNeedSyncAppUpdateInfo())) {
      return;
    }

    const key = Math.random().toString();
    const response = await AxiosInstance.get<IAppUpdateInfoData>(
      `https://data.onekey.so/config.json?nocache=${key}`,
    );
    const releaseInfo = handleReleaseInfo(response.data);
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
