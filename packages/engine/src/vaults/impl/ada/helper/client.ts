import axios, { AxiosInstance } from 'axios';
import BigNumber from 'bignumber.js';

import {
  IAdaAccount,
  IAdaAddress,
  IAdaAmount,
  IAdaTransaction,
  IAdaUTXO,
  ITransactionListItem,
} from '../types';

class Client {
  readonly request: AxiosInstance;

  constructor(url: string) {
    this.request = axios.create({
      baseURL: 'https://node.onekeytest.com/ada',
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

  async getAccount(address: string): Promise<IAdaAddress> {
    return this.request
      .get<IAdaAddress>(`/addresses/${address}`)
      .then((i) => i.data);
  }

  async getBalance(stakeAddress: string): Promise<BigNumber> {
    const res = await this.request
      .get<IAdaAccount>(`/accounts/${stakeAddress}`)
      .then((i) => i.data);
    const balance = new BigNumber(res.controlled_amount) ?? 0;
    return balance;
  }

  async getUTXOs(address: string): Promise<IAdaUTXO[]> {
    return this.request
      .get<IAdaUTXO[]>(`/addresses/${address}/utxos`)
      .then((i) => i.data);
  }

  async getTransactions(address: string): Promise<ITransactionListItem[]> {
    return this.request
      .get<ITransactionListItem[]>(`/addresses/${address}/transactions`)
      .then((i) => i.data);
  }

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
