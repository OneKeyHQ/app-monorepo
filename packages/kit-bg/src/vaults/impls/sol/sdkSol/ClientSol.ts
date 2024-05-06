import type { IUnionMsgType } from '@onekeyhq/core/src/chains/lightning/types';
import type { IBackgroundApi } from '@onekeyhq/kit-bg/src/apis/IBackgroundApi';
import type { OneKeyError } from '@onekeyhq/shared/src/errors';
import { memoizee } from '@onekeyhq/shared/src/utils/cacheUtils';
import timerUtils from '@onekeyhq/shared/src/utils/timerUtils';
import type {
  IAuthResponse,
  ICreateInvoiceResponse,
  ICreateUserResponse,
  IInvoiceConfig,
} from '@onekeyhq/shared/types/lightning';
import type { IOneKeyAPIBaseResponse } from '@onekeyhq/shared/types/request';

import type { AxiosInstance } from 'axios';

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

class ClientSol {
  private backgroundApi: IBackgroundApi;

  constructor(backgroundApi: any) {
    this.backgroundApi = backgroundApi;
  }

  async getMinimumBalanceForRentExemption(dataLength: number): Promise<number> {
    const response = await this.backgroundApi.serviceDApp.proxyRPCCall<number>({
      networkId: 'sol',
      request: {
        method: ERpcMethods.GET_MINIMUM_BALANCE_FOR_RENT_EXEMPTION,
        params: [dataLength],
      },
    });

    return response;
  }

  async getLatestBlockHash() {
    const response = await this.backgroundApi.serviceDApp.proxyRPCCall<{
      value: { blockhash: string; lastValidBlockHeight: number };
    }>({
      networkId: 'sol',
      request: {
        method: ERpcMethods.GET_LATEST_BLOCK_HASH,
        params: [
          {
            commitment: 'confirmed',
          },
        ],
      },
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
}

export default ClientSol;
