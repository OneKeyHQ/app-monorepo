import { type AxiosError, type AxiosInstance, isAxiosError } from 'axios';

import type { IUnionMsgType } from '@onekeyhq/core/src/chains/lightning/types';
import type { IBackgroundApi } from '@onekeyhq/kit-bg/src/apis/IBackgroundApi';
import type { OneKeyError } from '@onekeyhq/shared/src/errors';
import { memoizee } from '@onekeyhq/shared/src/utils/cacheUtils';
import timerUtils from '@onekeyhq/shared/src/utils/timerUtils';
import type {
  IAuthResponse,
  ICreateInvoiceResponse,
  ICreateUserResponse,
  IInvoiceConfig,
} from '@onekeyhq/shared/types/lightning';
import type { IOneKeyAPIBaseResponse } from '@onekeyhq/shared/types/request';

function isAuthError(error: unknown): boolean {
  return (error as OneKeyError) && (error as OneKeyError).code === 401;
}

class ClientLightning {
  private backgroundApi: IBackgroundApi;

  private request: AxiosInstance;

  private testnet: boolean;

  readonly prefix = '/lightning/v1';

  readonly maxRetryCount = 3;

  constructor(backgroundApi: any, client: AxiosInstance, isTestnet: boolean) {
    this.request = client;
    this.testnet = isTestnet;
    this.backgroundApi = backgroundApi;
  }

  retryOperation = async <T>(
    fn: () => Promise<T>,
    shouldRetry: (error: unknown) => boolean,
    onRetry: () => Promise<void>,
    retryCount = 0,
    maxRetryCount = 3,
    waitTime = 1000,
  ): Promise<T> => {
    try {
      return await fn();
    } catch (error) {
      if (!shouldRetry(error) || retryCount >= maxRetryCount) {
        throw error;
      }

      console.log('Retrying operation due to error:', error);
      await onRetry();
      if (retryCount > 0) {
        await timerUtils.wait(waitTime);
      }

      return this.retryOperation(
        fn,
        shouldRetry,
        onRetry,
        retryCount + 1,
        maxRetryCount,
        waitTime,
      );
    }
  };

  async checkAccountExist(address: string) {
    return this.request
      .get<{ data: boolean }>(`${this.prefix}/account/check`, {
        params: { address, testnet: this.testnet },
      })
      .then((i) => i.data.data);
  }

  async createUser({
    hashPubKey,
    address,
    signature,
    randomSeed,
  }: {
    hashPubKey: string;
    address: string;
    signature: string;
    randomSeed: number;
  }) {
    return this.request
      .post<ICreateUserResponse>(`${this.prefix}/account/`, {
        hashPubKey,
        address,
        signature,
        randomSeed,
        testnet: this.testnet,
      })
      .then((i) => i.data.data);
  }

  async fetchSignTemplate(
    address: string,
    signType: 'register' | 'auth' | 'transfer',
  ): Promise<IUnionMsgType> {
    return this.request
      .get<IOneKeyAPIBaseResponse<IUnionMsgType>>(
        `${this.prefix}/account/get-sign-template`,
        {
          params: { address, signType, testnet: this.testnet },
        },
      )
      .then((i) => i.data.data);
  }

  async refreshAccessToken({
    hashPubKey,
    address,
    signature,
    timestamp,
    randomSeed,
  }: {
    hashPubKey: string;
    address: string;
    signature: string;
    timestamp: number;
    randomSeed: number;
  }) {
    try {
      if (!hashPubKey || !address || !signature) {
        throw new Error('Invalid exchange token params');
      }
      return await this.request
        .post<IAuthResponse>(`${this.prefix}/account/auth`, {
          hashPubKey,
          address,
          signature,
          timestamp,
          randomSeed,
          testnet: this.testnet,
        })
        .then((i) => i.data);
    } catch (e) {
      console.log('=====>>>exchange token failed: ', e);
      throw e;
    }
  }

  getConfig = memoizee(
    async () =>
      this.request
        .get<IOneKeyAPIBaseResponse<IInvoiceConfig>>(
          `${this.prefix}/invoices/config`,
          {
            params: { testnet: this.testnet },
          },
        )
        .then((i) => i.data.data),
    {
      promise: true,
      maxAge: timerUtils.getTimeDurationMs({ seconds: 60 }),
    },
  );

  async createInvoice({
    accountId,
    networkId,
    address,
    amount,
    description,
  }: {
    accountId: string;
    networkId: string;
    address: string;
    amount: string;
    description?: string;
  }): Promise<ICreateInvoiceResponse['data']> {
    return this.retryOperation(
      async () => {
        const res = await this.request.post<ICreateInvoiceResponse>(
          `${this.prefix}/invoices/create`,
          {
            amount,
            description: description || 'OneKey Invoice',
            testnet: this.testnet,
          },
          {
            // headers: {
            //   Authorization: await this.getAuthorization(address),
            // },
          },
        );
        return res.data.data;
      },
      isAuthError,
      async () => {
        await this.backgroundApi.serviceLightning.exchangeToken({
          accountId,
          networkId,
        });
      },
    );
  }
}

export default ClientLightning;
