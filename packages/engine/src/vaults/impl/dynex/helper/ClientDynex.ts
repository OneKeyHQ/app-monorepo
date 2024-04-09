// eslint-disable-next-line @typescript-eslint/naming-convention
import { TOKEN_PROGRAM_ID } from '@solana/spl-token';
import axios from 'axios';
import BigNumber from 'bignumber.js';
import { map, max } from 'lodash';

import { BaseClient } from '@onekeyhq/engine/src/client/BaseClient';
import { JsonRPCRequest } from '@onekeyhq/shared/src/request/JsonRPCRequest';

import { getSolScanEndpoint } from '../../../../endpoint';
import { TransactionStatus } from '../../../../types/provider';

import type { CoinInfo } from '../../../../types/chain';
import type {
  AddressInfo,
  ClientInfo,
  FeePricePerUnit,
  PartialTokenInfo,
} from '../../../../types/provider';
import type { ISolScanTokenMeta } from '../types';
import type { AccountInfo, PublicKey } from '@solana/web3.js';

// eslint-disable-next-line @typescript-eslint/naming-convention
export enum RPC_METHODS {
  GET_TRANSACTIONS_BY_ADDRESS = 'gettransactionsbyaddress',
  GET_BALANCE_OF_ADDRESS = 'getbalanceofaddress',
  GET_TRANSACTION = 'gettransaction',
  GET_BLOCK_COUNT = 'getblockcount',
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

  async getBlockCount(): Promise<number> {
    const resp = await this.rpc.call<{ count: number }>(
      RPC_METHODS.GET_BLOCK_COUNT,
      [],
    );
    return resp.count;
  }

  async getTransactionStatuses(
    txids: string[],
  ): Promise<Array<TransactionStatus | undefined>> {
    const calls: Array<any> = txids.map((txid) => [
      RPC_METHODS.GET_TRANSACTION,
      [
        txid,
        {
          encoding: PARAMS_ENCODINGS.JSON_PARSED,
          maxSupportedTransactionVersion: 0,
        },
      ],
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
}
