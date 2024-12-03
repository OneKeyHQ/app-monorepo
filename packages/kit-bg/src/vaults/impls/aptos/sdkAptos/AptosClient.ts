/* eslint-disable spellcheck/spell-checker */
import { Aptos, AptosConfig, Network } from '@aptos-labs/ts-sdk';

import type { IBackgroundApi } from '@onekeyhq/kit-bg/src/apis/IBackgroundApi';

import type {
  AccountAddressInput,
  MoveModuleBytecode,
  MoveResource,
  PaginationArgs,
  TransactionResponse,
} from '@aptos-labs/ts-sdk';

export class AptosClient {
  backgroundApi: IBackgroundApi;

  networkId: string;

  aptos: Aptos;

  constructor({
    backgroundApi,
    networkId,
  }: {
    backgroundApi: any;
    networkId: string;
  }) {
    const config = new AptosConfig({ network: Network.MAINNET });
    this.aptos = new Aptos(config);
    this.backgroundApi = backgroundApi;
    this.networkId = networkId;
  }

  async getAccountModules(
    accountAddress: string,
    query?: any,
  ): Promise<MoveModuleBytecode[]> {
    const out = await this.proxyRequest<MoveModuleBytecode[]>(
      'getAccountModules',
      [accountAddress, query],
    );
    return out;
  }

  getChainId(): Promise<number> {
    return this.proxyRequest('getChainId', []);
  }

  getAccount(
    accountAddress: AccountAddressInput,
  ): Promise<{ sequence_number: string; authentication_key: string }> {
    return this.proxyRequest('getAccount', [accountAddress]);
  }

  getTransactionByHash(txnHash: string): Promise<TransactionResponse> {
    return this.proxyRequest<TransactionResponse>('getTransactionByHash', [
      txnHash,
    ]);
  }

  getTransactions(
    query?: PaginationArgs | undefined,
  ): Promise<TransactionResponse[]> {
    return this.aptos.transaction.getTransactions({ options: query });
  }

  getAccountTransactions(
    accountAddress: AccountAddressInput,
    query?: PaginationArgs | undefined,
  ): Promise<TransactionResponse[]> {
    return this.proxyRequest<TransactionResponse[]>('getAccountTransactions', [
      accountAddress,
      query,
    ]);
  }

  getAccountResources(
    accountAddress: AccountAddressInput,
    query?: { ledgerVersion?: (number | bigint) | undefined } | undefined,
  ): Promise<MoveResource[]> {
    return this.proxyRequest('getAccountResources', [accountAddress, query]);
  }

  getLedgerInfo(): Promise<{
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
