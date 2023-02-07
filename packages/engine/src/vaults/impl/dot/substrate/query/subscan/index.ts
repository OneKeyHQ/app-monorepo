import axios from 'axios';

import { OneKeyError } from '@onekeyhq/engine/src/errors';
import { getChainIdFromNetworkId } from '@onekeyhq/engine/src/managers/network';

import { Cache } from '../../../utils/cache';
import { BaseDotClient } from '../BaseDotClient';

import type { Extrinsic, Response, Transaction } from './type';
import type { AxiosResponse } from 'axios';

interface ConnectionConfig {
  allowCache: boolean;
}

const CACHE_DEFAULT_EXPIRATION_TIME = 5000; // 5s

export class SubScanClient extends BaseDotClient {
  protected readonly cache: Cache;

  public constructor(cache: Cache = new Cache(CACHE_DEFAULT_EXPIRATION_TIME)) {
    super();
    this.cache = cache;
  }

  private getBaseUrl(networkId: string) {
    const chainId = getChainIdFromNetworkId(networkId);
    return `https://${chainId}.api.subscan.io/api/scan`;
  }

  private async postJson<T>(
    networkId: string,
    url: string,
    data: any,
    config: ConnectionConfig = { allowCache: true },
  ): Promise<T> {
    const key = `${url}-${JSON.stringify(data)}`;
    const baseUrl = this.getBaseUrl(networkId);

    const res = await this.cache
      .get<AxiosResponse<Response<T>>>(key)
      .catch(() => {
        const resPromise = axios.post<Response<T>>(`${baseUrl}/${url}`, data, {
          headers: {
            'Content-Type': 'application/json',
          },
        });
        return this.cache.save(key, resPromise, {
          cacheValue: config.allowCache,
        });
      });

    if (res.data.code === 0) {
      return res.data.data;
    }
    throw new OneKeyError(`SubScanClient.postJson: ${res.data.message}`);
  }

  async getTransaction(networkId: string, hash: string): Promise<Extrinsic> {
    return this.postJson<Extrinsic>(networkId, 'extrinsic', {
      hash,
    });
  }

  async getTransactions(
    networkId: string,
    address: string,
  ): Promise<Transaction[]> {
    return this.postJson<{
      extrinsics: Transaction[];
    }>(networkId, 'extrinsics', {
      address,
      'row': 20,
      'page': 0,
    }).then((res) => res.extrinsics ?? []);
  }
}
