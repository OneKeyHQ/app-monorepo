import type { IUnionMsgType } from '@onekeyhq/core/src/chains/lightning/types';
import { memoizee } from '@onekeyhq/shared/src/utils/cacheUtils';
import timerUtils from '@onekeyhq/shared/src/utils/timerUtils';
import type {
  ICreateUserResponse,
  IInvoiceConfig,
} from '@onekeyhq/shared/types/lightning';
import type { IOneKeyAPIBaseResponse } from '@onekeyhq/shared/types/request';

import type { AxiosError, AxiosInstance } from 'axios';

class ClientLightning {
  private request: AxiosInstance;

  private testnet: boolean;

  readonly prefix = '/lightning/v1';

  constructor(client: AxiosInstance, isTestnet: boolean) {
    this.request = client;
    this.testnet = isTestnet;

    this.request.interceptors.response.use(
      (response) => response,
      (error: AxiosError) => {
        const status = error.response ? error.response.status : null;
        if (status === 401) {
          // TODO: replace i18n error
          return Promise.reject(new Error('Bad Auth'));
        }
        return Promise.reject(error);
      },
    );
  }

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
}

export default ClientLightning;
