import axios from 'axios';

import { getActiveWalletAccount } from '@onekeyhq/kit/src/hooks/redux';
import {
  backgroundClass,
  backgroundMethod,
} from '@onekeyhq/shared/src/background/backgroundDecorators';

import type { IBackgroundApi } from '../IBackgroundApi';
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

  get client() {
    if (!this._client) {
      this._client = axios.create({ timeout: 60 * 1000 });
    }
    return this._client;
  }

  backgroundApi: IBackgroundApi;

  @backgroundMethod()
  async getActiveWalletAccount() {
    // eslint-disable-next-line @typescript-eslint/await-thenable
    const result = await getActiveWalletAccount();
    return Promise.resolve(result);
  }
}
