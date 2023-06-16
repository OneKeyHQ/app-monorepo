import axios from 'axios';
import BigNumber from 'bignumber.js';
import memoizee from 'memoizee';

import { getTimeDurationMs } from '@onekeyhq/kit/src/utils/helper';

import { getFiatEndpoint } from '../../../../endpoint';

import type {
  IBalanceResponse,
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
import type { AxiosError, AxiosInstance, AxiosPromise } from 'axios';

type IExchangeToken = () => Promise<{
  hashPubKey: string;
  address: string;
  signature: string;
} | null>;

let isRefreshing = false;
let subscribers: (() => AxiosPromise<any>)[] = [];

class ClientLighting {
  readonly request: AxiosInstance;

  exchangeToken?: IExchangeToken;

  constructor(exchangeToken?: IExchangeToken) {
    this.exchangeToken = exchangeToken;
    this.request = axios.create({
      // baseURL: `${getFiatEndpoint()}/api`,
      baseURL: `http://localhost:9000/api/lighting`,
      timeout: 20000,
    });

    this.request.interceptors.request.use((config) => {
      if (config.headers) {
        config.headers['XXX-LN'] = '1';
      }
      return config;
    });

    this.request.interceptors.response.use(
      (response) => response,
      (error: AxiosError) => {
        const status = error.response ? error.response.status : null;
        if (status === 401) {
          if (!isRefreshing) {
            isRefreshing = true;
            const originalConfig = error.config;
            subscribers.push(() => this.request(originalConfig));
            this.refreshAccessToken()
              .then(() => {
                subscribers.forEach((callback) => callback());
                subscribers = [];
              })
              .finally(() => {
                isRefreshing = false;
              });
          }
          return new Promise((resolve) => {
            subscribers.push((() => {
              this.request(error.config).then(resolve);
            }) as any);
          });
        }
        return Promise.reject(error);
      },
    );
  }

  async refreshAccessToken() {
    try {
      const params = await this.exchangeToken?.();
      if (!params) {
        throw new Error('no exchange token params');
      }
      await this.request.post('/account/auth', { ...params });
    } catch (e) {
      console.log('=====>>>exchange token failed: ', e);
      throw e;
    }
  }

  async checkAccountExist(address: string) {
    return this.request
      .get<boolean>('/account/check', {
        params: { address },
      })
      .then((i) => i.data);
  }

  async createUser({
    hashPubKey,
    address,
    signature,
  }: {
    hashPubKey: string;
    address: string;
    signature: string;
  }) {
    return this.request
      .post<ICreateUserResponse>('/account/users', {
        hashPubKey,
        address,
        signature,
      })
      .then((i) => i.data);
  }

  async batchGetBalance(addresses: string[]) {
    try {
      return await this.request
        .post<IBatchBalanceResponse[]>('/account/balance', { addresses })
        .then((i) => i.data);
    } catch (e) {
      return [];
    }
  }

  async createInvoice(address: string, amount: string, description?: string) {
    return this.request
      .post<ICretaeInvoiceResponse>('/invoices/create', {
        address,
        amount,
        description: description || 'OneKey Invoice',
      })
      .then((i) => i.data);
  }

  async decodedInvoice(invoice: string) {
    return this.request
      .get<IInvoiceDecodedResponse>('/invoices/decoded', {
        params: { invoice },
      })
      .then((i) => i.data);
  }

  specialInvoice = memoizee(
    async (address: string, paymentHash: string) =>
      this.request
        .get<InvoiceType>('/invoices/invoice', {
          params: {
            address,
            paymentHash,
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
        params: { address },
      })
      .then((i) => i.data + 1);
  }

  async paymentBolt11(params: IPaymentBolt11Params) {
    return this.request
      .post<{ paymentRequest: string; nonce: number }>(
        '/payments/bolt11',
        params,
      )
      .then((i) => i.data);
  }

  async checkBolt11({ address, nonce }: { address: string; nonce: number }) {
    return this.request
      .get<ICheckPaymentResponse>('/payments/checkBolt11', {
        params: { address, nonce },
      })
      .then((i) => i.data);
  }

  async fetchHistory(address: string): Promise<IHistoryItem[]> {
    return this.request
      .get<IHistoryItem[]>('/invoices/history', { params: { address } })
      .then((i) => i.data);
  }
}

export default ClientLighting;
