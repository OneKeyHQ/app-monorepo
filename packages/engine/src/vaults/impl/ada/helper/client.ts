import axios, { AxiosInstance } from 'axios';
import BigNumber from 'bignumber.js';

import {
  IAdaAccount,
  IAdaAmount,
  IAdaTransaction,
  IAdaUTXO,
  ITransactionListItem,
} from '../types';

class Client {
  readonly request: AxiosInstance;

  constructor(url: string) {
    this.request = axios.create({
      baseURL: url,
      timeout: 20000,
    });
  }

  async latestBlock() {
    const res = await this.request
      .get<{ height: number }>('/')
      .then((i) => i.data);
    return {
      height: Number(res.height ?? 0),
    };
  }

  async getAccount(address: string): Promise<IAdaAccount> {
    return this.request
      .get<IAdaAccount>(`/addresses/${address}`)
      .then((i) => i.data);
  }

  async getBalance(address: string): Promise<BigNumber> {
    const res = await this.request
      .get<IAdaAccount>(`/addresses/${address}`)
      .then((i) => i.data);
    const { amount } = res;
    const lovelace =
      amount.find((item: IAdaAmount) => item.unit === 'lovelace')?.quantity ??
      0;
    const balance = new BigNumber(lovelace) ?? 0;
    return balance;
  }

  async getUTXOs(address: string): Promise<IAdaUTXO[]> {
    return this.request
      .get<IAdaUTXO[]>(`/addresses/${address}`)
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
