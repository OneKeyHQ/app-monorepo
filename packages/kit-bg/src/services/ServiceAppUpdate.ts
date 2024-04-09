import axios from 'axios';

import {
  EAppUpdateStatus,
  type IAppUpdateInfoData,
  handleReleaseInfo,
} from '@onekeyhq/shared/src/appUpdate';
import {
  backgroundClass,
  backgroundMethod,
} from '@onekeyhq/shared/src/background/backgroundDecorators';

import { appUpdatePersistAtom } from '../states/jotai/atoms';

import ServiceBase from './ServiceBase';

const AxiosInstance = axios.create();

@backgroundClass()
class ServiceAppUpdate extends ServiceBase {
  constructor({ backgroundApi }: { backgroundApi: any }) {
    super({ backgroundApi });
  }

  @backgroundMethod()
  async checkUpdateStatus() {
    const { version, latestVersion, status } = await appUpdatePersistAtom.get();
    if (version === latestVersion) {
      if (status !== EAppUpdateStatus.done) {
        await appUpdatePersistAtom.set((prev) => ({
          ...prev,
          status: EAppUpdateStatus.done,
        }));
      }
    }
  }

  @backgroundMethod()
  async isNeedSyncAppUpdateInfo() {
    const { status } = await appUpdatePersistAtom.get();
    return ![EAppUpdateStatus.downloading, EAppUpdateStatus.ready].includes(
      status,
    );
  }

  @backgroundMethod()
  public async fetchAppUpdateInfo() {
    await this.checkUpdateStatus();
    // downloading app or ready to update via local package
    if (!(await this.isNeedSyncAppUpdateInfo())) {
      return;
    }

    const key = Math.random().toString();
    const response = await AxiosInstance.get<IAppUpdateInfoData>(
      `https://data.onekey.so/config.json?nocache=${key}`,
    );
    const releaseInfo = handleReleaseInfo(response.data);
    const { latestVersion } = await appUpdatePersistAtom.get();

    await appUpdatePersistAtom.set((prev) => ({
      ...prev,
      ...releaseInfo,
      updateAt: Date.now(),
      status:
        releaseInfo.latestVersion !== latestVersion
          ? EAppUpdateStatus.notify
          : prev.status,
    }));
  }
}

export default ServiceAppUpdate;
