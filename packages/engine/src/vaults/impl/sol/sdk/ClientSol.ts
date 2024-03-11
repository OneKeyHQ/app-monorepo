// eslint-disable-next-line @typescript-eslint/naming-convention
import { TOKEN_PROGRAM_ID } from '@solana/spl-token';
import BigNumber from 'bignumber.js';
import { map, max } from 'lodash';

import { BaseClient } from '@onekeyhq/engine/src/client/BaseClient';
import { JsonRPCRequest } from '@onekeyhq/shared/src/request/JsonRPCRequest';

import { TransactionStatus } from '../../../../types/provider';

import type { CoinInfo } from '../../../../types/chain';
import type {
  AddressInfo,
  ClientInfo,
  FeePricePerUnit,
  PartialTokenInfo,
} from '../../../../types/provider';
import type { AccountInfo, PublicKey } from '@solana/web3.js';

// eslint-disable-next-line @typescript-eslint/naming-convention
export enum RPC_METHODS {
  SEND_TRANSACTION = 'sendTransaction',
  GET_EPOCH_INFO = 'getEpochInfo',
  GET_HEALTH = 'getHealth',
  GET_ACCOUNT_INFO = 'getAccountInfo',
  GET_TOKEN_ACCOUNTS_BY_OWNER = 'getTokenAccountsByOwner',
  GET_FEES = 'getFees',
  GET_FEES_FOR_MESSAGE = 'getFeeForMessage',
  GET_RECENT_PRIORITIZATION_FEES = 'getRecentPrioritizationFees',
  GET_TRANSACTION = 'getTransaction',
  GET_MINIMUM_BALANCE_FOR_RENT_EXEMPTION = 'getMinimumBalanceForRentExemption',
  GET_LATEST_BLOCK_HASH = 'getLatestBlockhash',
}
// eslint-disable-next-line @typescript-eslint/naming-convention
export enum PARAMS_ENCODINGS {
  BASE64 = 'base64',
  JSON_PARSED = 'jsonParsed',
}

export class ClientSol extends BaseClient {
  readonly rpc: JsonRPCRequest;

  constructor(url: string) {
    super();
    this.rpc = new JsonRPCRequest(url);
  }

  async broadcastTransaction(rawTx: string, options?: any): Promise<string> {
    return this.rpc.call(RPC_METHODS.SEND_TRANSACTION, [
      rawTx,
      { encoding: PARAMS_ENCODINGS.BASE64, ...(options || {}) },
    ]);
  }

  async getInfo(): Promise<ClientInfo> {
    // @ts-ignore
    const [epochInfo, ok] = await this.rpc.batchCall([
      [RPC_METHODS.GET_EPOCH_INFO, []],
      [RPC_METHODS.GET_HEALTH, []],
    ]);
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    const slot = epochInfo.absoluteSlot;
    const isReady = ok === 'ok';
    return {
      bestBlockNumber: slot,
      isReady,
    };
  }

  async getAddresses(
    addresses: string[],
  ): Promise<Array<AddressInfo | undefined>> {
    const calls: Array<any> = addresses.map((address) => [
      RPC_METHODS.GET_ACCOUNT_INFO,
      [address, { encoding: PARAMS_ENCODINGS.JSON_PARSED }],
    ]);
    const resp: Array<{ [key: string]: any } | undefined> =
      await this.rpc.batchCall(calls);
    const result: Array<AddressInfo | undefined> = [];
    for (const accountInfo of resp) {
      if (typeof accountInfo !== 'undefined') {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        const balance = new BigNumber(accountInfo?.value?.lamports);
        const existing = balance.isFinite() && balance.gte(0);
        result.push({
          existing,
          balance: existing ? balance : new BigNumber(0),
        });
      } else {
        result.push(undefined);
      }
    }
    return result;
  }

  async getBalances(
    requests: { address: string; coin: Partial<CoinInfo> }[],
  ): Promise<(BigNumber | undefined)[]> {
    const calls: Array<any> = requests.map((request) =>
      request.coin?.tokenAddress
        ? [
            RPC_METHODS.GET_TOKEN_ACCOUNTS_BY_OWNER,
            [
              request.address,
              { mint: request.coin.tokenAddress },
              {
                encoding: PARAMS_ENCODINGS.JSON_PARSED,
                commitment: 'processed',
              },
            ],
          ]
        : [
            RPC_METHODS.GET_ACCOUNT_INFO,
            [
              request.address,
              {
                encoding: PARAMS_ENCODINGS.JSON_PARSED,
                commitment: 'processed',
              },
            ],
          ],
    );
    const resps: Array<{ [key: string]: any } | undefined> =
      await this.rpc.batchCall(calls);
    const result: Array<BigNumber | undefined> = [];
    resps.forEach((resp, i) => {
      if (typeof resp !== 'undefined') {
        let balance = new BigNumber(0);
        if (requests[i].coin?.tokenAddress) {
          for (const tokenAccount of resp.value) {
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
            const { info } = tokenAccount.account.data.parsed;
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
            if (info.owner === requests[i].address) {
              // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
              balance = BigNumber.sum(balance, info.tokenAmount.amount);
            } else {
              // TODO: send sentry warnings
            }
          }
        } else if (resp.value !== null) {
          // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
          balance = new BigNumber(resp.value.lamports);
        }
        result.push(balance);
      } else {
        result.push(undefined);
      }
    });
    return result;
  }

  async getAccountInfo(
    address: string,
    encoding: PARAMS_ENCODINGS = PARAMS_ENCODINGS.JSON_PARSED,
  ): Promise<AccountInfo<[string, string]> | null> {
    const response: { [key: string]: any } = await this.rpc.call(
      RPC_METHODS.GET_ACCOUNT_INFO,
      [address, { encoding }],
    );
    // eslint-disable-next-line @typescript-eslint/no-unsafe-return
    return response.value;
  }

  async getTokenAccountsByOwner({
    address,
    programId = TOKEN_PROGRAM_ID,
  }: {
    address: string;
    programId?: PublicKey;
  }): Promise<
    | {
        account: {
          data: {
            parsed: {
              info: {
                mint: string;
                owner: string;
              };
            };
          };
          owner: string;
        };
        pubkey: string;
      }[]
    | null
  > {
    const response: {
      [key: string]: any;
    } = await this.rpc.call(RPC_METHODS.GET_TOKEN_ACCOUNTS_BY_OWNER, [
      address,
      {
        programId: programId.toString(),
      },
      { encoding: PARAMS_ENCODINGS.JSON_PARSED },
    ]);
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

  async getFeesForMessage(message: string) {
    const resp = await this.rpc.call<{
      value: number;
    }>(RPC_METHODS.GET_FEES_FOR_MESSAGE, [
      message,
      {
        commitment: 'confirmed',
      },
    ]);

    return resp.value;
  }

  async getRecentPrioritizationFees(accountAddresses: string[]) {
    const resp = await this.rpc.call<
      { slot: number; prioritizationFee: number }[]
    >(RPC_METHODS.GET_RECENT_PRIORITIZATION_FEES, [accountAddresses]);

    return resp;
  }

  async getRecentMaxPrioritizationFees(accountAddress: string[]) {
    const resp = await this.getRecentPrioritizationFees(accountAddress);
    return max(map(resp, 'prioritizationFee')) || 0;
  }

  async getLatestBlockHash() {
    const resp = await this.rpc.call<{
      value: { blockhash: string; lastValidBlockHeight: number };
    }>(RPC_METHODS.GET_LATEST_BLOCK_HASH, [
      {
        commitment: 'confirmed',
      },
    ]);

    return {
      blockhash: resp.value.blockhash,
      lastValidBlockHeight: resp.value.lastValidBlockHeight,
    };
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

  async getMinimumBalanceForRentExemption(dataLength: number): Promise<number> {
    const response: number = await this.rpc.call(
      RPC_METHODS.GET_MINIMUM_BALANCE_FOR_RENT_EXEMPTION,
      [dataLength],
    );

    return response;
  }

  override getTokenInfos = async (
    tokenAddresses: Array<string>,
  ): Promise<Array<PartialTokenInfo | undefined>> => {
    const calls: any = tokenAddresses.map((address) => [
      RPC_METHODS.GET_ACCOUNT_INFO,
      [address, { encoding: PARAMS_ENCODINGS.JSON_PARSED }],
    ]);
    const resp: Array<{ [key: string]: any } | undefined> =
      await this.rpc.batchCall(calls);
    const tokenInfos: Array<PartialTokenInfo | undefined> = [];
    resp.forEach((tokenInfo, i) => {
      if (typeof tokenInfo !== 'undefined') {
        if (
          tokenInfo.value !== null &&
          // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
          tokenInfo.value.data.parsed.type === 'mint'
        ) {
          // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
          const accountInfo = tokenInfo.value.data.parsed;
          // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
          const { decimals } = accountInfo.info;
          const name = tokenAddresses[i].slice(0, 4);
          tokenInfos.push({
            name,
            symbol: name.toUpperCase(),
            decimals,
          });
        } else {
          console.error('invalid token address');
          tokenInfos.push(undefined);
        }
      } else {
        tokenInfos.push(undefined);
      }
    });

    return tokenInfos;
  };
}
