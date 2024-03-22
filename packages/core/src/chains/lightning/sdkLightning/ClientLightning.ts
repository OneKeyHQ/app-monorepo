import axios from 'axios';

import type { IUnionMsgType } from './signature';
import type { ICreateUserResponse } from '../types/account';
import type { AxiosError, AxiosInstance } from 'axios';

class ClientLightning {
  readonly request: AxiosInstance;

  private testnet: boolean;

  constructor(isTestnet: boolean) {
    this.testnet = isTestnet;

    this.request = axios.create({
      baseURL: 'http://localhost:9007',
      timeout: 20000,
    });

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

  async fetchSignTemplate(
    address: string,
    signType: 'register' | 'auth' | 'transfer',
  ) {
    return this.request
      .get<IUnionMsgType>('/account/getSignTemplate', {
        params: { address, signType, testnet: this.testnet },
      })
      .then((i) => i.data);
  }
}

export default ClientLightning;
