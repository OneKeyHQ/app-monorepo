import { appApiClient } from '@onekeyhq/shared/src/appApiClient/appApiClient';
import {
  backgroundClass,
  backgroundMethod,
} from '@onekeyhq/shared/src/background/backgroundDecorators';
import type { EServiceEndpointEnum } from '@onekeyhq/shared/types/endpoint';

import { getEndpointInfo } from '../endpoints';

import type { IBackgroundApi } from '../apis/IBackgroundApi';

export type IServiceBaseProps = {
  backgroundApi: any;
};

@backgroundClass()
export default class ServiceBase {
  constructor({ backgroundApi }: IServiceBaseProps) {
    this.backgroundApi = backgroundApi;
  }

  backgroundApi: IBackgroundApi;

  _currentNetworkId: string | undefined;

  _currentAccountId: string | undefined;

  getClient = async (name: EServiceEndpointEnum) =>
    appApiClient.getClient(await getEndpointInfo({ name }));

  getRawDataClient = async (name: EServiceEndpointEnum) =>
    appApiClient.getRawDataClient(await getEndpointInfo({ name }));

  @backgroundMethod()
  async getActiveWalletAccount() {
    // eslint-disable-next-line @typescript-eslint/await-thenable
    // const result = await getActiveWalletAccount();
    // return Promise.resolve(result);
  }

  async getActiveVault() {
    // const { networkId, accountId } = await this.getActiveWalletAccount();
    // return this.backgroundApi.engine.getVault({ networkId, accountId });
  }

  @backgroundMethod()
  public async updateCurrentAccount({
    accountId,
    networkId,
  }: {
    accountId: string;
    networkId: string;
  }) {
    this._currentNetworkId = networkId;
    this._currentAccountId = accountId;
  }
}
