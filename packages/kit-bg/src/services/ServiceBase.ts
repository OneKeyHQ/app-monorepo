import axios from 'axios';
import memoizee from 'memoizee';

import { getTimeDurationMs } from '@onekeyhq/kit/src/utils/helper';
import {
  backgroundClass,
  backgroundMethod,
} from '@onekeyhq/shared/src/background/backgroundDecorators';
import { OneKeyError } from '@onekeyhq/shared/src/errors';
import type { EEndpointName } from '@onekeyhq/shared/types/endpoint';

import { getEndpoints } from '../endpoints';

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

  getClient = memoizee(
    async (endpointName?: EEndpointName) => {
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

      const client = axios.create({
        baseURL: endpoint,
        timeout: 60 * 1000,
      });
      return client;
    },
    {
      promise: true,
      primitive: true,
      maxAge: getTimeDurationMs({ minute: 10 }),
      max: 2,
    },
  );

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
