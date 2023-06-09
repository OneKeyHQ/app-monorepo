import { sha256 } from '@noble/hashes/sha256';
import { bytesToHex as toHex } from '@noble/hashes/utils';
import axios from 'axios';
import BigNumber from 'bignumber.js';

import { getFiatEndpoint } from '../../../../endpoint';

import type { IBalanceResponse, ICreateUserResponse } from '../types/account';
import type { AxiosInstance } from 'axios';

class ClientLighting {
  readonly request: AxiosInstance;

  constructor() {
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

  async getBalance(address: string) {
    return this.request
      .get<IBalanceResponse>('/account/balance', {
        params: { address },
      })
      .then((i) => {
        const { balance } = i.data;
        return new BigNumber(balance);
      });
  }
}

export default ClientLighting;
