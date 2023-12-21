import axios from 'axios';

import {
  backgroundClass,
  backgroundMethod,
} from '@onekeyhq/shared/src/background/backgroundDecorators';
import { OneKeyError } from '@onekeyhq/shared/src/errors';
import type { EEndpointName } from '@onekeyhq/shared/types/endpoint';

import { getEndpoints } from '../endpoints';

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

  async getClient(endpointName?: EEndpointName) {
    if (!this._client) {
      let endpoint = '';
      const endpoints = await getEndpoints();
      if (endpointName) {
        endpoint = endpoints[endpointName];
        if (!endpoint) {
          throw new OneKeyError('Invalid endpoint name.');
        }
      } else {
        endpoint = endpoints.http;
      }

      this._client = axios.create({
        baseURL: endpoint,
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
