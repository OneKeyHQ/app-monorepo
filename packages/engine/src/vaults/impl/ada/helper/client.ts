import axios, { AxiosInstance } from 'axios';
import BigNumber from 'bignumber.js';
import memoizee from 'memoizee';

import { getFiatEndpoint } from '@onekeyhq/engine/src/endpoint';

import { DBUTXOAccount } from '../../../../types/account';
import {
  IAdaAccount,
  IAdaAddress,
  IAdaAmount,
  IAdaHistory,
  IAdaTransaction,
  IAdaUTXO,
  IAsset,
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
          const pathArray = utxoPath.split('/');
          pathArray.splice(3, 1, pathIndex);
          utxoPath = pathArray.join('/');
        }
        return { ...utxo, path: utxoPath, output_index: utxo.tx_index };
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
    let tx: Buffer | null = null;
    if (typeof data === 'string') {
      tx = Buffer.from(data, 'hex');
    } else {
      tx = Buffer.from(data);
    }

    return this.request
      .post<{ data: any }>('/tx/submit', tx, {
        headers: {
          'Content-Type': 'application/cbor',
        },
      })
      .then((i) => i.data);
  }

  async getAssetDetail(asset: string): Promise<IAsset> {
    return this.request.get<IAsset>(`/assets/${asset}`).then((i) => i.data);
  }

  async getAssetsBalances(stakeAddress: string): Promise<IAdaAmount[]> {
    return this.request
      .get<IAdaAmount[]>(`/accounts/${stakeAddress}/addresses/assets`)
      .then((i) => i.data);
  }
}

export default Client;
