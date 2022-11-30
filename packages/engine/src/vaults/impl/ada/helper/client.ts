import axios, { AxiosInstance } from 'axios';
import BigNumber from 'bignumber.js';
import memoizee from 'memoizee';

import { getFiatEndpoint } from '@onekeyhq/engine/src/endpoint';

import { DBUTXOAccount } from '../../../../types/account';
import {
  IAdaAccount,
  IAdaAddress,
  IAdaHistory,
  IAdaTransaction,
  IAdaUTXO,
} from '../types';

class Client {
  readonly request: AxiosInstance;

  readonly backendRequest: AxiosInstance;

  constructor(url: string) {
    this.request = axios.create({
      baseURL: 'https://node.onekeytest.com/ada' ?? url,
      timeout: 20000,
    });

    this.backendRequest = axios.create({
      baseURL: `${getFiatEndpoint()}/cardano`,
      timeout: 20000,
    });
  }

  async latestBlock() {
    const res = await this.request
      .get<{ height: number }>('/blocks/latest')
      .then((i) => i.data);
    return {
      height: Number(res.height ?? 0),
    };
  }

  async getAddress(address: string): Promise<IAdaAddress> {
    return this.request
      .get<IAdaAddress>(`/addresses/${address}`)
      .then((i) => i.data);
  }

  async getAccount(stakeAddress: string): Promise<IAdaAccount> {
    return this.request
      .get<IAdaAccount>(`/accounts/${stakeAddress}`)
      .then((i) => i.data);
  }

  async getBalance(stakeAddress: string): Promise<BigNumber> {
    const res = await this.request
      .get<IAdaAccount>(`/accounts/${stakeAddress}`)
      .then((i) => i.data);
    const balance = new BigNumber(res.controlled_amount) ?? 0;
    return balance;
  }

  getUTXOs = memoizee(
    async (dbAccount: DBUTXOAccount): Promise<IAdaUTXO[]> => {
      const { xpub, addresses, path } = dbAccount;
      const stakeAddress = addresses['2/0'];
      const { data } = await this.backendRequest.get<IAdaUTXO[]>(
        `/utxos?stakeAddress=${stakeAddress}&xpub=${xpub}}`,
      );
      const pathIndex = path.split('/')[3];
      return data.map((utxo) => {
        let { path: utxoPath } = utxo;
        if (utxoPath && utxoPath.length > 0) {
          const pathArray = path.split('/');
          pathArray.splice(3, 1, pathIndex);
          utxoPath = pathArray.join('/');
        }
        return { ...utxo, path: utxoPath };
      });
    },
    {
      promise: true,
      maxAge: 1000 * 60,
    },
  );

  getHistory = memoizee(
    async (stakeAddress: string): Promise<IAdaHistory[]> =>
      this.backendRequest
        .get<IAdaHistory[]>(`/history/${stakeAddress}`)
        .then((i) => i.data),
    {
      promise: true,
      maxAge: 1000 * 60,
    },
  );

  async getRawTransaction(txid: string): Promise<IAdaTransaction> {
    return this.request
      .get<IAdaTransaction>(`/txs/${txid}`)
      .then((i) => i.data);
  }

  async submitTx(data: string) {
    return this.request.post('/tx/submit', { data });
  }
}

export default Client;
