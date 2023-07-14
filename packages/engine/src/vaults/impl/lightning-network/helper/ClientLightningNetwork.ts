import axios from 'axios';

import simpleDb from '@onekeyhq/engine/src/dbs/simple/simpleDb';
import { getTimeDurationMs } from '@onekeyhq/kit/src/utils/helper';
import { memoizee } from '@onekeyhq/shared/src/utils/cacheUtils';

import { getFiatEndpoint } from '../../../../endpoint';
import { BadAuthError } from '../../../../errors';

import type {
  IAuthResponse,
  IBatchBalanceResponse,
  ICreateUserResponse,
} from '../types/account';
import type {
  ICretaeInvoiceResponse,
  IHistoryItem,
  IInvoiceDecodedResponse,
  InvoiceType,
} from '../types/invoice';
import type {
  ICheckPaymentResponse,
  IPaymentBolt11Params,
} from '../types/payments';
import type { UnionMsgType } from './signature';
import type { AxiosError, AxiosInstance } from 'axios';

class ClientLightning {
  readonly request: AxiosInstance;

  private testnet: boolean;

  constructor(isTestnet: boolean) {
    this.testnet = isTestnet;

    this.request = axios.create({
      baseURL: `${getFiatEndpoint()}/lightning`,
      timeout: 20000,
    });

    this.request.interceptors.response.use(
      (response) => response,
      (error: AxiosError) => {
        const status = error.response ? error.response.status : null;
        if (status === 401) {
          return Promise.reject(new BadAuthError());
        }
        return Promise.reject(error);
      },
    );
  }

  private async getAuthorization(address: string) {
    const authorization = await simpleDb.utxoAccounts.getLndAccessToken(
      address,
    );
    if (authorization && authorization.length) {
      return `Bearer ${authorization}`;
    }
    return '';
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
        .post<IAuthResponse>('/account/auth', {
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

  async checkAccountExist(address: string) {
    return this.request
      .get<boolean>('/account/check', {
        params: { address, testnet: this.testnet },
      })
      .then((i) => i.data);
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
      .post<ICreateUserResponse>('/account/users', {
        hashPubKey,
        address,
        signature,
        randomSeed,
        testnet: this.testnet,
      })
      .then((i) => i.data);
  }

  async batchGetBalance(addresses: string[]) {
    try {
      return await this.request
        .post<IBatchBalanceResponse[]>('/account/balance', {
          addresses,
          testnet: this.testnet,
        })
        .then((i) => i.data);
    } catch (e) {
      return [];
    }
  }

  async createInvoice(address: string, amount: string, description?: string) {
    return this.request
      .post<ICretaeInvoiceResponse>(
        '/invoices/create',
        {
          amount,
          description: description || 'OneKey Invoice',
          testnet: this.testnet,
        },
        {
          headers: {
            Authorization: await this.getAuthorization(address),
          },
        },
      )
      .then((i) => i.data);
  }

  async decodedInvoice(invoice: string) {
    return this.request
      .get<IInvoiceDecodedResponse>('/invoices/decoded', {
        params: { invoice, testnet: this.testnet },
      })
      .then((i) => i.data);
  }

  specialInvoice = memoizee(
    async (address: string, paymentHash: string) =>
      this.request
        .get<InvoiceType>('/invoices/invoice', {
          params: {
            paymentHash,
            testnet: this.testnet,
          },
          headers: {
            Authorization: await this.getAuthorization(address),
          },
        })
        .then((i) => i.data),
    {
      promise: true,
      maxAge: getTimeDurationMs({ seconds: 1 }),
    },
  );

  async getNextNonce(address: string) {
    return this.request
      .get<number>('/payments/getNonce', {
        params: { testnet: this.testnet },
        headers: {
          Authorization: await this.getAuthorization(address),
        },
      })
      .then((i) => i.data + 1);
  }

  async paymentBolt11(params: IPaymentBolt11Params, address: string) {
    return this.request
      .post<{ paymentRequest: string; nonce: number }>(
        '/payments/bolt11',
        { ...params, testnet: this.testnet },
        {
          headers: {
            Authorization: await this.getAuthorization(address),
          },
        },
      )
      .then((i) => i.data);
  }

  async checkBolt11({ address, nonce }: { address: string; nonce: number }) {
    return this.request
      .get<ICheckPaymentResponse>('/payments/checkBolt11', {
        params: { nonce, testnet: this.testnet },
        headers: {
          Authorization: await this.getAuthorization(address),
        },
      })
      .then((i) => i.data);
  }

  async fetchHistory(address: string): Promise<IHistoryItem[]> {
    return this.request
      .get<IHistoryItem[]>('/invoices/history', {
        params: { testnet: this.testnet },
        headers: {
          Authorization: await this.getAuthorization(address),
        },
      })
      .then((i) => i.data);
  }

  async fetchSignTemplate(
    address: string,
    signType: 'register' | 'auth' | 'transfer',
  ) {
    return this.request
      .get<UnionMsgType>('/account/getSignTemplate', {
        params: { address, signType, testnet: this.testnet },
        headers: {
          Authorization: await this.getAuthorization(address),
        },
      })
      .then((i) => i.data);
  }
}

export default ClientLightning;
