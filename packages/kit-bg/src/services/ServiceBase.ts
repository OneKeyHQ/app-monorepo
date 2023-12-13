import axios from 'axios';

import {
  backgroundClass,
  backgroundMethod,
} from '@onekeyhq/shared/src/background/backgroundDecorators';

import { settingsPersistAtom } from '../states/jotai/atoms';

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

  async getClient() {
    if (!this._client) {
      const settings = await settingsPersistAtom.get();

      this._client = axios.create({
        headers: {
          'x-onekey-currency': settings.currency,
        },
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
