import {
  AptosClient as BaseAptosClient,
  Network,
  NetworkToNodeAPI,
} from 'aptos';

import type { IBackgroundApi } from '@onekeyhq/kit-bg/src/apis/IBackgroundApi';

import type { MaybeHexString, PaginationArgs, Types } from 'aptos';

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
    const out = await this.proxyRequest<Types.MoveModuleBytecode[]>(
      'getAccountModules',
      [accountAddress, query],
    );
    return out;
  }

  override getChainId(): Promise<number> {
    return this.proxyRequest('getChainId', []);
  }

  override getAccount(
    accountAddress: MaybeHexString,
  ): Promise<{ sequence_number: string; authentication_key: string }> {
    return this.proxyRequest('getAccount', [accountAddress]);
  }

  override getTransactionByHash(txnHash: string): Promise<Types.Transaction> {
    return this.proxyRequest('getTransactionByHash', [txnHash]);
  }

  override getAccountTransactions(
    accountAddress: MaybeHexString,
    query?: PaginationArgs | undefined,
  ): Promise<Types.Transaction[]> {
    return this.proxyRequest('getAccountTransactions', [accountAddress, query]);
  }

  override getAccountResources(
    accountAddress: MaybeHexString,
    query?: { ledgerVersion?: (number | bigint) | undefined } | undefined,
  ): Promise<{ type: string; data: any }[]> {
    return this.proxyRequest('getAccountResources', [accountAddress, query]);
  }

  override getLedgerInfo(): Promise<{
    chain_id: number;
    epoch: string;
    ledger_version: string;
    oldest_ledger_version: string;
    ledger_timestamp: string;
    node_role: any;
    oldest_block_height: string;
    block_height: string;
    git_hash?: string | undefined;
  }> {
    return this.proxyRequest('getLedgerInfo');
  }

  async proxyRequest<T>(method: string, params?: any): Promise<T> {
    const res: T[] =
      await this.backgroundApi.serviceAccountProfile.sendProxyRequest({
        networkId: this.networkId,
        body: [
          {
            route: 'rpc',
            params: {
              method,
              params,
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
