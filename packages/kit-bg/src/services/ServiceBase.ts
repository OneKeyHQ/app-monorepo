import axios from 'axios';

import {
  backgroundClass,
  backgroundMethod,
} from '@onekeyhq/shared/src/background/backgroundDecorators';
import { OneKeyError } from '@onekeyhq/shared/src/errors';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { memoizee } from '@onekeyhq/shared/src/utils/cacheUtils';
import timerUtils from '@onekeyhq/shared/src/utils/timerUtils';
import type { EEndpointName } from '@onekeyhq/shared/types/endpoint';

import { getEndpoints } from '../endpoints';

import type { IBackgroundApi } from '../apis/IBackgroundApi';
import type { AxiosInstance } from 'axios';

export type IServiceBaseProps = {
  backgroundApi: any;
};

let client: AxiosInstance | null = null;

@backgroundClass()
export default class ServiceBase {
  constructor({ backgroundApi }: IServiceBaseProps) {
    this.backgroundApi = backgroundApi;
  }

  backgroundApi: IBackgroundApi;

  getClient = memoizee(
    async (endpointName?: EEndpointName) => {
      if (client && !endpointName) return client;

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
      const options =
        platformEnv.isDev && process.env.ONEKEY_PROXY
          ? {
              baseURL: platformEnv.isExtension ? 'http://localhost:3180' : '/',
              timeout: 60 * 1000,
              headers: {
                'x-proxy': endpoint,
              },
            }
          : {
              baseURL: endpoint,
              timeout: 60 * 1000,
            };
      client = axios.create(options);

      return client;
    },
    {
      promise: true,
      primitive: true,
      maxAge: timerUtils.getTimeDurationMs({ minute: 10 }),
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
