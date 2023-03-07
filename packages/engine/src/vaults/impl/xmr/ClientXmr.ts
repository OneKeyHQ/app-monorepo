// eslint-disable-next-line @typescript-eslint/naming-convention
import LWSClient from '@mymonero/mymonero-lws-client';
import MoneroParser from '@mymonero/mymonero-response-parser-utils';
import axios from 'axios';
import BigNumber from 'bignumber.js';

import { BaseClient } from '@onekeyhq/engine/src/client/BaseClient';
import type { ChainInfo, CoinInfo } from '@onekeyhq/engine/src/types/chain';
import { JsonRPCRequest } from '@onekeyhq/shared/src/request/JsonRPCRequest';

import { TransactionStatus } from '../../../types/provider';

import { MoneroAddressInfo } from './types';

import type { MoneroCoreInstance } from './sdk/moneroCore/moneroCoreTypes';
import type { MoneroKeys } from './types';

// eslint-disable-next-line @typescript-eslint/naming-convention
export enum RPC_METHODS {
  SEND_TRANSACTION = 'sendTransaction',
  GET_EPOCH_INFO = 'getEpochInfo',
  GET_HEALTH = 'getHealth',
  GET_ACCOUNT_INFO = 'getAccountInfo',
  GET_BALANCE = 'get_balance',
  GET_FEES = 'getFees',
  GET_TRANSACTION = 'getTransaction',
  GET_LAST_BLOCK_HEADER = 'get_last_block_header',
}
// eslint-disable-next-line @typescript-eslint/naming-convention
export enum PARAMS_ENCODINGS {
  BASE64 = 'base64',
  JSON_PARSED = 'jsonParsed',
}

export class ClientXmr extends BaseClient {
  readonly rpc: JsonRPCRequest;

  readonly wallet: LWSClient;

  readonly moneroCoreInstance: MoneroCoreInstance;

  readonly keys: MoneroKeys;

  constructor(
    rpcUrl: string,
    walletUrl: string,
    moneroCoreInstance: MoneroCoreInstance,
    keys: MoneroKeys,
  ) {
    super();
    const instance = axios.create({
      baseURL: walletUrl,
    });
    this.moneroCoreInstance = moneroCoreInstance;
    this.rpc = new JsonRPCRequest(rpcUrl);
    this.wallet = new LWSClient({ url: walletUrl, httpClient: instance });
    this.keys = {
      publicViewKey: Buffer.from(keys.publicViewKey ?? '').toString('hex'),
      publicSpendKey: Buffer.from(keys.publicSpendKey ?? '').toString('hex'),
      privateViewKey: Buffer.from(keys.privateViewKey ?? '').toString('hex'),
      privateSpendKey: Buffer.from(keys.privateSpendKey ?? '').toString('hex'),
    };
  }

  async broadcastTransaction(rawTx: string, options?: any): Promise<string> {
    return this.rpc.call(RPC_METHODS.SEND_TRANSACTION, [
      rawTx,
      { encoding: PARAMS_ENCODINGS.BASE64, ...(options || {}) },
    ]);
  }

  async getBalances(
    requests: Array<{
      address: string;
      coin: Partial<CoinInfo>;
    }>,
  ): Promise<(BigNumber | undefined)[]> {
    try {
      const [request] = requests;

      const { publicSpendKey, privateViewKey, privateSpendKey } = this.keys;

      const addressInfo = await this.wallet.getAddressInfo(
        privateViewKey,
        request.address,
      );

      const spentOutputs = addressInfo.spent_outputs || [];

      for (const spentOutput of spentOutputs) {
        const keyImage = this.moneroCoreInstance.generate_key_image(
          spentOutput.tx_pub_key,
          privateViewKey,
          publicSpendKey,
          privateSpendKey,
          String(spentOutput.out_index),
        );
        console.log(keyImage);
      }

      return [];
    } catch (e) {
      console.log(e);
      return [];
    }
  }

  async getAccountInfo(
    address: string,
  ): Promise<{ [key: string]: any } | null> {
    const response: { [key: string]: any } = await this.rpc.call(
      RPC_METHODS.GET_ACCOUNT_INFO,
      [address, { encoding: PARAMS_ENCODINGS.JSON_PARSED }],
    );
    // eslint-disable-next-line @typescript-eslint/no-unsafe-return
    return response.value;
  }

  async getFeePricePerUnit(): Promise<FeePricePerUnit> {
    const [feePerSig] = await this.getFees();
    return {
      normal: {
        price: new BigNumber(feePerSig),
      },
    };
  }

  async getFees(): Promise<[number, string]> {
    const feeInfo: { [key: string]: any } = await this.rpc.call(
      RPC_METHODS.GET_FEES,
    );
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    const feePerSig = feeInfo.value.feeCalculator.lamportsPerSignature;
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    const recentBlockhash = feeInfo.value.blockhash;
    return [feePerSig, recentBlockhash];
  }

  async getTransactionStatuses(
    txids: string[],
  ): Promise<Array<TransactionStatus | undefined>> {
    const calls: Array<any> = txids.map((txid) => [
      RPC_METHODS.GET_TRANSACTION,
      [txid, PARAMS_ENCODINGS.JSON_PARSED],
    ]);
    const result = [];
    const resp: Array<{ [key: string]: any } | undefined> =
      await this.rpc.batchCall(calls);
    for (const tx of resp) {
      if (typeof tx !== 'undefined') {
        if (tx === null) {
          result.push(TransactionStatus.NOT_FOUND);
        } else {
          result.push(
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
            tx.meta.err === null
              ? TransactionStatus.CONFIRM_AND_SUCCESS
              : TransactionStatus.CONFIRM_BUT_FAILED,
          );
        }
      } else {
        result.push(undefined);
      }
    }

    return result;
  }

  async getClientEndpointStatus(url: string) {
    return this.rpc.call(RPC_METHODS.GET_LAST_BLOCK_HEADER);
  }
}
