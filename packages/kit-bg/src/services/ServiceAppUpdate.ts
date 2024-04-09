import axios from 'axios';

import {
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
  public async fetchAppUpdateInfo() {
    const key = Math.random().toString();
    const response = await AxiosInstance.get<IAppUpdateInfoData>(
      `https://data.onekey.so/config.json?nocache=${key}`,
    );
    await appUpdatePersistAtom.set((prev) => ({
      ...prev,
      ...handleReleaseInfo(response.data),
    }));
  }
}

export default ServiceAppUpdate;
