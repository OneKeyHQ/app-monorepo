import { TOKEN_PROGRAM_ID } from '@solana/spl-token';
import { map, max } from 'lodash';

import type { IBackgroundApi } from '@onekeyhq/kit-bg/src/apis/IBackgroundApi';

import type { AccountInfo, PublicKey } from '@solana/web3.js';

export enum EParamsEncodings {
  BASE64 = 'base64',
  JSON_PARSED = 'jsonParsed',
}

export enum ERpcMethods {
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

export const MIN_PRIORITY_FEE = 1000000;

class ClientSol {
  private networkId: string;

  private backgroundApi: IBackgroundApi;

  constructor({
    networkId,
    backgroundApi,
  }: {
    networkId: string;
    backgroundApi: any;
  }) {
    this.networkId = networkId;
    this.backgroundApi = backgroundApi;
  }

  async getMinimumBalanceForRentExemption(dataLength: number): Promise<number> {
    const [response] =
      await this.backgroundApi.serviceAccountProfile.sendProxyRequest<number>({
        networkId: this.networkId,
        body: [
          {
            route: 'rpc',
            params: {
              method: ERpcMethods.GET_MINIMUM_BALANCE_FOR_RENT_EXEMPTION,
              params: [dataLength],
            },
          },
        ],
      });

    return response;
  }

  async getLatestBlockHash() {
    const [response] =
      await this.backgroundApi.serviceAccountProfile.sendProxyRequest<{
        value: { blockhash: string; lastValidBlockHeight: number };
      }>({
        networkId: this.networkId,
        body: [
          {
            route: 'rpc',
            params: {
              method: ERpcMethods.GET_LATEST_BLOCK_HASH,
              params: [
                {
                  commitment: 'confirmed',
                },
              ],
            },
          },
        ],
      });

    return {
      recentBlockhash: response.value.blockhash,
      lastValidBlockHeight: response.value.lastValidBlockHeight,
    };
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
    const [response] =
      await this.backgroundApi.serviceAccountProfile.sendProxyRequest<{
        [key: string]: any;
      }>({
        networkId: this.networkId,
        body: [
          {
            route: 'rpc',
            params: {
              method: ERpcMethods.GET_TOKEN_ACCOUNTS_BY_OWNER,
              params: [
                address,
                {
                  programId: programId.toString(),
                },
                { encoding: EParamsEncodings.JSON_PARSED },
              ],
            },
          },
        ],
      });

    // eslint-disable-next-line @typescript-eslint/no-unsafe-return
    return response.value;
  }

  async getAccountInfo({
    address,
    encoding = EParamsEncodings.JSON_PARSED,
  }: {
    address: string;
    encoding?: EParamsEncodings;
  }): Promise<AccountInfo<[string, string]> | null> {
    const [response] =
      await this.backgroundApi.serviceAccountProfile.sendProxyRequest<{
        value: AccountInfo<[string, string]>;
      }>({
        networkId: this.networkId,
        body: [
          {
            route: 'rpc',
            params: {
              method: ERpcMethods.GET_ACCOUNT_INFO,
              params: [address, { encoding }],
            },
          },
        ],
      });

    return response.value;
  }

  async getRecentPrioritizationFees(accountAddresses: string[]) {
    const [response] =
      await this.backgroundApi.serviceAccountProfile.sendProxyRequest<
        { slot: number; prioritizationFee: number }[]
      >({
        networkId: this.networkId,
        body: [
          {
            route: 'rpc',
            params: {
              method: ERpcMethods.GET_RECENT_PRIORITIZATION_FEES,
              params: [accountAddresses],
            },
          },
        ],
      });

    return response;
  }

  async getRecentMaxPrioritizationFees(accountAddress: string[]) {
    const resp = await this.getRecentPrioritizationFees(accountAddress);
    return max(map(resp, 'prioritizationFee')) || 0;
  }
}

export default ClientSol;
