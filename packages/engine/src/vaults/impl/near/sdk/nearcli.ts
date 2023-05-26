/* eslint-disable @typescript-eslint/naming-convention,camelcase,@typescript-eslint/no-unsafe-member-access,@typescript-eslint/no-unsafe-call,@typescript-eslint/no-shadow,@typescript-eslint/no-unsafe-return,@typescript-eslint/restrict-plus-operands */
import BigNumber from 'bignumber.js';
import * as borsh from 'borsh';

import { SimpleClient } from '@onekeyhq/engine/src/client/BaseClient';
import type { CoinInfo } from '@onekeyhq/engine/src/types/chain';
import { TransactionStatus } from '@onekeyhq/engine/src/types/provider';
import type {
  AddressInfo,
  ClientInfo,
  FeePricePerUnit,
} from '@onekeyhq/engine/src/types/provider';
import { JsonPRCResponseError } from '@onekeyhq/shared/src/errors/request-errors';
import { JsonRPCRequest } from '@onekeyhq/shared/src/request/JsonRPCRequest';

import type { GasCostConfig, NearAccessKey } from '../types';

function parseJsonFromRawResponse(response: Uint8Array): any {
  return JSON.parse(Buffer.from(response).toString());
}

function bytesJsonStringify(input: any): Buffer {
  return Buffer.from(JSON.stringify(input));
}

class NearCli extends SimpleClient {
  readonly rpc: JsonRPCRequest;

  constructor(
    url: string,
    readonly defaultFinality: 'optimistic' | 'final' = 'optimistic',
  ) {
    super();
    this.rpc = new JsonRPCRequest(url);
  }

  async getInfo(): Promise<ClientInfo> {
    const { blockNumber } = await this.getBestBlock();
    const isReady = Number.isFinite(blockNumber) && blockNumber > 0;

    return {
      bestBlockNumber: blockNumber,
      isReady,
    };
  }

  async getTxCostConfig(): Promise<Record<string, GasCostConfig>> {
    const resp: any = await this.rpc.call('EXPERIMENTAL_protocol_config', {
      finality: this.defaultFinality,
    });
    const {
      runtime_config: {
        transaction_costs: {
          // eslint-disable-next-line @typescript-eslint/naming-convention,camelcase
          action_receipt_creation_config,
          action_creation_config: { transfer_cost },
        },
      },
    } = resp;

    return {
      action_receipt_creation_config,
      transfer_cost,
    };
  }

  async getBestBlock(): Promise<{ blockNumber: number; blockHash: string }> {
    const resp: any = await this.rpc.call('status', []);
    return {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      blockNumber: Number(resp.sync_info.latest_block_height),
      blockHash: resp.sync_info.latest_block_hash,
    };
  }

  async getAddress(address: string): Promise<AddressInfo> {
    try {
      const balanceInfo: any = await this.rpc.call('query', {
        request_type: 'view_account',
        account_id: address,
        finality: this.defaultFinality,
      });
      const balance = new BigNumber(balanceInfo.amount);
      const accessKeys = await this.getAccessKeys(address);
      const fullAccessKeys = accessKeys.filter((i) => i.type === 'FullAccess');
      const [{ nonce }] =
        fullAccessKeys.length > 0 ? fullAccessKeys : accessKeys;

      return {
        existing: true,
        balance,
        nonce: Number.isFinite(nonce) && nonce > 0 ? nonce : undefined,
      };
    } catch (e) {
      if (e instanceof JsonPRCResponseError && e.response) {
        try {
          // @ts-ignore
          // eslint-disable-next-line @typescript-eslint/no-unsafe-call
          const error: any = await e.response.json();
          if (error?.cause?.name === 'UNKNOWN_ACCOUNT') {
            return {
              existing: false,
              balance: new BigNumber(0),
            };
          }
          // eslint-disable-next-line @typescript-eslint/no-shadow
        } catch (e) {
          // ignored
        }
      }

      throw e;
    }
  }

  async getAccessKeys(address: string): Promise<NearAccessKey[]> {
    const info: any = await this.rpc.call('query', {
      request_type: 'view_access_key_list',
      account_id: address,
      finality: this.defaultFinality,
    });

    // eslint-disable-next-line @typescript-eslint/no-unsafe-return
    return info.keys.map((key: any) => {
      const { permission } = key.access_key;
      const isFullAccessKey = permission === 'FullAccess';

      return {
        type: isFullAccessKey ? 'FullAccess' : 'FunctionCall',
        pubkey: key.public_key,
        pubkeyHex: borsh
          .baseDecode(key.public_key.split(':')[1] || '')
          .toString('hex'),
        // eslint-disable-next-line @typescript-eslint/restrict-plus-operands
        nonce: key.access_key.nonce + 1,
        functionCall: !isFullAccessKey
          ? {
              allowance: permission.FunctionCall.allowance,
              receiverId: permission.FunctionCall.receiver_id,
              methodNames: permission.FunctionCall.method_names,
            }
          : undefined,
      };
    });
  }

  override getBalance = async (
    address: string,
    coin: Partial<CoinInfo>,
  ): Promise<BigNumber> => {
    if (coin?.tokenAddress) {
      const tokenBalanceStr: string = await this.callContract(
        coin.tokenAddress,
        'ft_balance_of',
        { account_id: address },
      );
      return new BigNumber(tokenBalanceStr);
    }
    const balanceInfo: any = await this.rpc.call('query', {
      request_type: 'view_account',
      account_id: address,
      finality: this.defaultFinality,
    });
    return new BigNumber(balanceInfo.amount);
  };

  async getFeePricePerUnit(): Promise<FeePricePerUnit> {
    const resp: any = await this.rpc.call('gas_price', [null]);
    const normalPrice = new BigNumber(resp.gas_price);

    return {
      normal: {
        price: normalPrice,
      },
    };
  }

  async getTransactionStatus(txid: string): Promise<TransactionStatus> {
    try {
      const resp: any = await this.rpc.call('tx', [
        txid,
        'dontcare', // required tx signer actually, but I found that just filling in any string works fine
      ]);

      if (typeof resp.status === 'object' && 'SuccessValue' in resp.status) {
        return TransactionStatus.CONFIRM_AND_SUCCESS;
      }
      return TransactionStatus.CONFIRM_BUT_FAILED;
    } catch (e) {
      if (e instanceof JsonPRCResponseError && e.response) {
        try {
          // @ts-ignore
          const error: any = await e.response.json();
          if (error?.cause?.name === 'UNKNOWN_TRANSACTION') {
            return TransactionStatus.NOT_FOUND;
          }
        } catch (e) {
          // ignored
        }
      }

      throw e;
    }
  }

  async callContract(
    contract: string,
    methodName: string,
    args: any = {},
    { parse = parseJsonFromRawResponse, stringify = bytesJsonStringify } = {},
  ): Promise<any> {
    const serializedArgs = stringify(args).toString('base64');
    const result: any = await this.rpc.call('query', {
      request_type: 'call_function',
      finality: this.defaultFinality,
      method_name: methodName,
      account_id: contract,
      args_base64: serializedArgs,
    });

    return (
      result.result &&
      result.result.length > 0 &&
      parse(Buffer.from(result.result))
    );
  }

  async broadcastTransaction(rawTx: string): Promise<string> {
    const tx: any = await this.rpc.call('broadcast_tx_commit', [rawTx]);
    return tx.transaction.hash;
  }
}

export { NearCli };
