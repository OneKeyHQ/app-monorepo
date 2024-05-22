import {
  AptosClient as BaseAptosClient,
  Network,
  NetworkToNodeAPI,
} from 'aptos';

import type { IBackgroundApi } from '@onekeyhq/kit-bg/src/apis/IBackgroundApi';

import type { MaybeHexString, Types } from 'aptos';

export class AptosClient extends BaseAptosClient {
  backgroundApi: IBackgroundApi;

  networkId: string;

  constructor({
    backgroundApi,
    networkId,
  }: {
    backgroundApi: any;
    networkId: string;
  }) {
    super(NetworkToNodeAPI[Network.MAINNET]);
    this.backgroundApi = backgroundApi;
    this.networkId = networkId;
  }

  override async getAccountModules(
    accountAddress: string,
    query?: any,
  ): Promise<Types.MoveModuleBytecode[]> {
    const out = await this.aptosRequest<Types.MoveModuleBytecode[]>(
      'getAccountModules',
      [accountAddress, query],
    );
    return out;
  }

  override getChainId(): Promise<number> {
    return this.aptosRequest('getChainId', []);
  }

  override getAccount(
    accountAddress: MaybeHexString,
  ): Promise<{ sequence_number: string; authentication_key: string }> {
    return this.aptosRequest('getAccount', [accountAddress]);
  }

  override getTransactionByHash(txnHash: string): Promise<Types.Transaction> {
    return this.aptosRequest('getTransactionByHash', [txnHash]);
  }

  async aptosRequest<T>(method: string, args: any): Promise<T> {
    const res: T[] =
      await this.backgroundApi.serviceAccountProfile.sendProxyRequest({
        networkId: this.networkId,
        body: [
          {
            route: 'rpc',
            params: {
              method,
              params: args,
            },
          },
        ],
      });
    const response = res?.[0];
    if (!response) {
      throw new Error('No response received from the proxy');
    }

    return response;
  }
}
