import axios from 'axios';

import { getTimeDurationMs } from '@onekeyhq/kit/src/utils/helper';
import { memoizee } from '@onekeyhq/shared/src/utils/cacheUtils';

import { getFiatEndpoint } from '../../../../endpoint';
import { BadAuthError } from '../../../../errors';

import type {
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
import type { AxiosError, AxiosInstance } from 'axios';

class ClientLightning {
  readonly request: AxiosInstance;

  constructor() {
    this.request = axios.create({
      baseURL: `${getFiatEndpoint()}/api/lightning`,
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

  async refreshAccessToken({
    hashPubKey,
    address,
    signature,
    timestamp,
  }: {
    hashPubKey: string;
    address: string;
    signature: string;
    timestamp: number;
  }) {
    try {
      if (!hashPubKey || !address || !signature) {
        throw new Error('Invalid exchange token params');
      }
      await this.request.post('/account/auth', {
        hashPubKey,
        address,
        signature,
        timestamp,
      });
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

export default ClientLightning;
