import axios from 'axios';
import BigNumber from 'bignumber.js';

import { BaseClient } from '@onekeyhq/engine/src/client/BaseClient';
import { JsonRPCRequest } from '@onekeyhq/shared/src/request/JsonRPCRequest';

import { NotImplemented } from '../../../../errors';
import { TransactionStatus } from '../../../../types/provider';

import type {
  AddressInfo,
  ClientInfo,
  FeePricePerUnit,
} from '../../../../types/provider';
import type {
  IOnChainBalance,
  IOnChainNodeInfo,
  IOnChainTransaction,
  IOnChainTransactionsItem,
} from '../types';

// eslint-disable-next-line @typescript-eslint/naming-convention
export enum RPC_METHODS {
  GET_TRANSACTIONS_BY_ADDRESS = 'gettransactionsbyaddress',
  GET_BALANCE_OF_ADDRESS = 'getbalanceofaddress',
  GET_TRANSACTION = 'gettransaction',
  GET_BLOCK_COUNT = 'getblockcount',
  VALIDATE_ADDRESS = 'validateaddress',
}
// eslint-disable-next-line @typescript-eslint/naming-convention
export enum PARAMS_ENCODINGS {
  BASE64 = 'base64',
  JSON_PARSED = 'jsonParsed',
}

export class ClientDynex extends BaseClient {
  readonly baseURL: string;

  readonly rpc: JsonRPCRequest;

  constructor(url: string) {
    super();
    this.baseURL = url;
    this.rpc = new JsonRPCRequest(`${url}/json_rpc`);
  }

  checkDynexNodeResponse({
    resp,
    method,
  }: {
    resp: { status: string };
    method: string;
  }) {
    if (!resp || !resp.status || resp.status.toLowerCase() !== 'ok') {
      throw new Error(`${method}: Failed to get response from Dynex node`);
    }
  }

  async getBlockCount(): Promise<number> {
    const resp = await this.rpc.call<{ count: number }>(
      RPC_METHODS.GET_BLOCK_COUNT,
      [],
    );
    return resp.count;
  }

  async getBalanceOfAddress(address: string): Promise<BigNumber> {
    const resp = await this.rpc.call<{
      status: string;
      balance: IOnChainBalance;
    }>(RPC_METHODS.GET_BALANCE_OF_ADDRESS, {
      address,
    });

    try {
      this.checkDynexNodeResponse({ resp, method: 'getBalanceOfAddress' });
    } catch {
      return new BigNumber(0);
    }

    return new BigNumber(resp.balance.balance ?? 0);
  }

  async validateAddress(address: string): Promise<boolean> {
    const resp = await this.rpc.call<{
      status: string;
      isvalid: boolean;
    }>(RPC_METHODS.VALIDATE_ADDRESS, {
      address,
    });

    try {
      this.checkDynexNodeResponse({ resp, method: 'validateAddress' });
    } catch {
      return false;
    }

    return resp.isvalid;
  }

  async getNodeInfo(): Promise<IOnChainNodeInfo> {
    const resp = await axios.get<IOnChainNodeInfo>(`${this.baseURL}/getinfo`);
    return resp.data;
  }

  async getTransaction(txid: string): Promise<IOnChainTransaction> {
    const resp = await this.rpc.call<{
      status: string;
      transaction: IOnChainTransaction;
    }>(RPC_METHODS.GET_TRANSACTION, {
      hash: txid,
    });
    this.checkDynexNodeResponse({ resp, method: 'getTransaction' });

    return resp.transaction;
  }

  async getTransactionStatus(txid: string): Promise<TransactionStatus> {
    try {
      const tx = await this.getTransaction(txid);
      if (tx.inBlockchain) {
        return TransactionStatus.CONFIRM_AND_SUCCESS;
      }
      return TransactionStatus.PENDING;
    } catch (err) {
      return TransactionStatus.PENDING;
    }
  }

  async getTransactionsByAddress(
    address: string,
  ): Promise<IOnChainTransactionsItem[]> {
    const resp = await this.rpc.call<{
      status: string;
      transactions: IOnChainTransactionsItem[];
    }>(RPC_METHODS.GET_TRANSACTIONS_BY_ADDRESS, {
      address,
    });

    this.checkDynexNodeResponse({ resp, method: 'getTransactionsByAddress' });

    return resp.transactions;
  }

  override getInfo(): Promise<ClientInfo> {
    throw new NotImplemented();
  }

  override getAddresses(): Promise<(AddressInfo | undefined)[]> {
    throw new NotImplemented();
  }

  override getFeePricePerUnit(): Promise<FeePricePerUnit> {
    throw new NotImplemented();
  }

  override async broadcastTransaction(rawTx: string): Promise<string> {
    const resp = await axios.post<{ status: string }>(
      `${this.baseURL}/sendrawtransaction`,
      {
        tx_as_hex: rawTx,
        do_not_relay: false,
      },
    );

    if (!resp.data.status || resp.data.status !== 'OK')
      throw new Error('Failed to send transaction');

    return resp.data.status;
  }

  override getBalances(): Promise<(BigNumber | undefined)[]> {
    throw new NotImplemented();
  }

  override getTransactionStatuses(): Promise<
    (TransactionStatus | undefined)[]
  > {
    throw new NotImplemented();
  }
}
