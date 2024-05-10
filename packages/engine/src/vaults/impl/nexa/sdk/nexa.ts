import BigNumber from 'bignumber.js';

import { WebSocketRequest } from '@onekeyhq/shared/src/request/WebSocketRequest';

import { SimpleClient } from '../../../../client/BaseClient';
import { TransactionStatus } from '../../../../types/provider';

import type {
  AddressInfo,
  ClientInfo,
  FeePricePerUnit,
} from '../../../../types/provider';
import type { IListUTXO, INexaHistoryItem, INexaTransaction } from '../types';

export class Nexa extends SimpleClient {
  readonly rpc: WebSocketRequest;

  readonly MAX_TX_NUM_VIN = 256;

  constructor(
    url: string,
    readonly defaultFinality: 'optimistic' | 'final' = 'optimistic',
  ) {
    super();
    this.rpc = new WebSocketRequest(url);
  }

  override getAddress(): Promise<AddressInfo> {
    throw new Error('Method not implemented.');
  }

  override async getInfo(): Promise<ClientInfo> {
    const info = await this.rpc.call<{
      height: number;
      hex: string;
    }>('blockchain.headers.tip');
    return {
      bestBlockNumber: info.height,
      isReady: true,
    };
  }

  override getFeePricePerUnit(): Promise<FeePricePerUnit> {
    throw new Error('Method not implemented.');
  }

  override async broadcastTransaction(rawTx: string): Promise<string> {
    // Totally different from that the response string is not txid but txidm.
    return this.rpc.call<string>('blockchain.transaction.broadcast', [rawTx]);
  }

  override async getBalance(address: string): Promise<BigNumber> {
    const balanceInfo = await this.rpc.call<{
      confirmed: number;
      unconfirmed: number;
    }>('blockchain.address.get_balance', [address]);
    return new BigNumber(balanceInfo.confirmed);
  }

  async getTransaction(txHash: string): Promise<INexaTransaction> {
    return this.rpc.call<INexaTransaction>('blockchain.transaction.get', [
      txHash,
      true,
    ]);
  }

  async estimateFee(size: number): Promise<number> {
    const fee = await this.rpc.call<number>('blockchain.estimatefee', [size]);
    return Number(fee) || 0;
  }

  async getNexaUTXOs(address: string): Promise<IListUTXO[]> {
    return this.rpc.call<IListUTXO[]>('blockchain.address.listunspent', [
      address,
    ]);
  }

  async getHistoryByAddress(address: string): Promise<INexaHistoryItem[]> {
    return this.rpc.call<INexaHistoryItem[]>('blockchain.address.get_history', [
      address,
    ]);
  }

  override async getTransactionStatus(
    txid: string,
  ): Promise<TransactionStatus> {
    const tx = await this.getTransaction(txid);
    return tx.confirmations > 0
      ? TransactionStatus.CONFIRM_AND_SUCCESS
      : TransactionStatus.PENDING;
  }

  override getTransactionStatuses(
    txids: string[],
  ): Promise<(TransactionStatus | undefined)[]> {
    return Promise.all(txids.map((txid) => this.getTransactionStatus(txid)));
  }
}
