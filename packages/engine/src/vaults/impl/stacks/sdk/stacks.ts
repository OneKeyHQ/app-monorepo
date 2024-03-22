import {
  AccountsApi,
  Configuration,
  FeesApi,
  InfoApi,
  TransactionsApi,
} from '@stacks/blockchain-api-client';
import { StacksMainnet, type StacksNetwork } from '@stacks/network';
import BigNumber from 'bignumber.js';

import { SimpleClient } from '../../../../client/BaseClient';
import { TransactionStatus } from '../../../../types/provider';

import type {
  AddressInfo,
  ClientInfo,
  FeePricePerUnit,
} from '../../../../types/provider';

export class Stacks extends SimpleClient {
  private readonly stacksNetwork: StacksNetwork;

  private readonly infoApi: InfoApi;

  private readonly feesApi: FeesApi;

  private readonly accountsApi: AccountsApi;

  private readonly transactionsApi: TransactionsApi;

  constructor(
    url: string,
    readonly defaultFinality: 'optimistic' | 'final' = 'optimistic',
  ) {
    super();
    this.stacksNetwork = new StacksMainnet({ url });
    const config = new Configuration({ basePath: url });
    this.infoApi = new InfoApi(config);
    this.feesApi = new FeesApi(config);
    this.accountsApi = new AccountsApi(config);
    this.transactionsApi = new TransactionsApi(config);
  }

  override getAddress(): Promise<AddressInfo> {
    throw new Error('Method not implemented.');
  }

  override async getInfo(): Promise<ClientInfo> {
    const { stacks_tip_height: bestBlockNumber } =
      await this.infoApi.getCoreApiInfo();
    return {
      bestBlockNumber,
      isReady: true,
    };
  }

  override async getFeePricePerUnit(): Promise<FeePricePerUnit> {
    const feeRate = (await this.feesApi.getFeeTransfer()) as unknown as number;
    return {
      normal: {
        price: new BigNumber(feeRate),
      },
    };
  }

  override async broadcastTransaction(rawTx: string): Promise<string> {
    return this.broadcastTransaction(rawTx);
  }

  override async getBalance(address: string): Promise<BigNumber> {
    const balanceInfo = await this.accountsApi.getAccountBalance({
      principal: address,
    });
    return new BigNumber(balanceInfo.stx.balance);
  }

  async estimateFee(size: number): Promise<number> {
    const fee = await this.feesApi.postFeeTransaction({
      transactionFeeEstimateRequest: {
        transaction_payload: '',
        estimated_len: size,
      },
    });
    return Number(fee) || 0;
  }

  override async getTransactionStatus(
    txId: string,
  ): Promise<TransactionStatus> {
    const tx = (await this.transactionsApi.getTransactionById({
      txId,
    })) as unknown as { tx_status: string };
    return tx.tx_status === 'success'
      ? TransactionStatus.CONFIRM_AND_SUCCESS
      : TransactionStatus.PENDING;
  }

  override getTransactionStatuses(
    txids: string[],
  ): Promise<(TransactionStatus | undefined)[]> {
    return Promise.all(txids.map((txid) => this.getTransactionStatus(txid)));
  }
}
