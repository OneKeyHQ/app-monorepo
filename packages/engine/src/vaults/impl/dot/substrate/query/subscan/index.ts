import axios from 'axios';
import memoizee from 'memoizee';

import { OneKeyError } from '@onekeyhq/engine/src/errors';
import { getChainIdFromNetworkId } from '@onekeyhq/engine/src/managers/network';

import { BaseDotClient } from '../BaseDotClient';

import type { Extrinsic, Response, Transaction, TransactionV2 } from './type';

interface ConnectionConfig {
  allowCache: boolean;
}

const CACHE_DEFAULT_EXPIRATION_TIME = 5000; // 5s

export class SubScanClient extends BaseDotClient {
  private getBaseUrl(networkId: string) {
    const chainId = getChainIdFromNetworkId(networkId);
    return `https://${chainId}.api.subscan.io/api`;
  }

  private async postJson<T>(
    networkId: string,
    url: string,
    data: any,
    config: ConnectionConfig = { allowCache: true },
  ): Promise<T> {
    if (config.allowCache) {
      return this.cacheRequest<T>(networkId, url, data);
    }
    return this.request<T>(networkId, url, data);
  }

  private async request<T>(networkId: string, url: string, data: any) {
    const baseUrl = this.getBaseUrl(networkId);

    return axios
      .post<Response<T>>(`${baseUrl}/${url}`, data, {
        headers: {
          'Content-Type': 'application/json',
        },
      })
      .then((res) => {
        if (res.data.code === 0) {
          return res.data.data;
        }
        throw new OneKeyError(`SubScanClient.postJson: ${res.data.message}`);
      });
  }

  private cacheRequest = memoizee(
    async <T>(networkId: string, url: string, data: any): Promise<T> =>
      this.request<T>(networkId, url, data),
    {
      promise: true,
      max: 10,
      normalizer: (args: [networkId: string, url: string, data: any]) => {
        const [networkId, url, data] = args;
        return `${networkId}-${url}-${JSON.stringify(data)}`;
      },
      maxAge: CACHE_DEFAULT_EXPIRATION_TIME,
    },
  );

  async getTransaction(networkId: string, hash: string): Promise<Extrinsic> {
    return this.postJson<Extrinsic>(networkId, 'scan/extrinsic', {
      hash,
    });
  }

  async getTransactions(
    networkId: string,
    address: string,
  ): Promise<Transaction[]> {
    return this.postJson<{
      extrinsics: Transaction[];
    }>(networkId, 'scan/extrinsics', {
      address,
      'row': 20,
      'page': 0,
    }).then((res) => res.extrinsics ?? []);
  }

  async getTransactionsV2(
    networkId: string,
    address: string,
  ): Promise<TransactionV2[]> {
    return this.postJson<{
      transfers: TransactionV2[];
    }>(networkId, 'v2/scan/transfers', {
      address,
      'row': 50,
      'page': 0,
      'direction': 'all',
    }).then((res) => res.transfers ?? []);
  }
}
