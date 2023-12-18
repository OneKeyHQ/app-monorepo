import axios from 'axios';

import {
  backgroundClass,
  backgroundMethod,
} from '@onekeyhq/shared/src/background/backgroundDecorators';

import type { IBackgroundApi } from '../apis/IBackgroundApi';
import type { AxiosInstance } from 'axios';

export type IServiceBaseProps = {
  backgroundApi: any;
};

@backgroundClass()
export default class ServiceBase {
  private _client!: AxiosInstance;

  constructor({ backgroundApi }: IServiceBaseProps) {
    this.backgroundApi = backgroundApi;
  }

  backgroundApi: IBackgroundApi;

  getClient() {
    if (!this._client) {
      this._client = axios.create({
        timeout: 60 * 1000,
      });
    }
    return this._client;
  }

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
}
