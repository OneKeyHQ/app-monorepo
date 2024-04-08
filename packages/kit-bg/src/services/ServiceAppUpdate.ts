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

@backgroundClass()
class ServiceAppUpdate extends ServiceBase {
  constructor({ backgroundApi }: { backgroundApi: any }) {
    super({ backgroundApi });
  }

  @backgroundMethod()
  public async fetchAppUpdateInfo() {
    // const client = await this.getClient();
    // const key = Math.random().toString();
    // const response = await client.get<{
    //   data: IAppUpdateInfoData;
    // }>(`/config.json?nocache=${key}`);
    // console.log('response', response);
    const response = {
      data: require('./data.json') as IAppUpdateInfoData,
    };
    await appUpdatePersistAtom.set((prev) => ({
      ...prev,
      ...handleReleaseInfo(response.data),
    }));
    console.log(response);
  }
}

export default ServiceAppUpdate;
