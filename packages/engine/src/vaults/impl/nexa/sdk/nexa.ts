import BigNumber from 'bignumber.js';

import { WebSocketRequest } from '@onekeyhq/shared/src/request/WebSocketRequest';

import { SimpleClient } from '../../../../client/BaseClient';

import type { CoinInfo } from '../../../../types/chain';
import type {
  AddressInfo,
  ClientInfo,
  FeePricePerUnit,
  TransactionStatus,
} from '../../../../types/provider';

export class Nexa extends SimpleClient {
  readonly rpc: WebSocketRequest;

  constructor(
    url: string,
    readonly defaultFinality: 'optimistic' | 'final' = 'optimistic',
  ) {
    super();
    this.rpc = new WebSocketRequest(url);
  }

  override getAddress(address: string): Promise<AddressInfo> {
    throw new Error('Method not implemented.');
  }

  override getTransactionStatus(txid: string): Promise<TransactionStatus> {
    throw new Error('Method not implemented.');
  }

  override getInfo(): Promise<ClientInfo> {
    throw new Error('Method not implemented.');
  }

  override getFeePricePerUnit(): Promise<FeePricePerUnit> {
    throw new Error('Method not implemented.');
  }

  override broadcastTransaction(rawTx: string, options?: any): Promise<string> {
    throw new Error('Method not implemented.');
  }

  override async getBalance(address: string): Promise<BigNumber> {
    const balanceInfo = await this.rpc.call<{
      confirmed: number;
      unconfirmed: number;
    }>('blockchain.address.get_balance', [address]);
    const a = new BigNumber(balanceInfo.confirmed);
    console.log(a);
    return new BigNumber(balanceInfo.confirmed);
  }
}
