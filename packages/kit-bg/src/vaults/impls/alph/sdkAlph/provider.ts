import { NodeProvider } from '@alephium/web3';

import type { IBackgroundApi } from '@onekeyhq/kit-bg/src/apis/IBackgroundApi';

import type { ApiRequestArguments } from '@alephium/web3';
import type {
  BuildTransaction,
  BuildTransactionResult,
  DecodeUnsignedTx,
  DecodeUnsignedTxResult,
} from '@alephium/web3/dist/src/api/api-alephium';

export class Provider extends NodeProvider {
  backgroundApi: IBackgroundApi;

  networkId: string;

  constructor({
    backgroundApi,
    networkId,
  }: {
    backgroundApi: IBackgroundApi;
    networkId: string;
  }) {
    super('');
    this.backgroundApi = backgroundApi;
    this.networkId = networkId;

    this.transactions.postTransactionsBuild = async (data: BuildTransaction) =>
      this.request({
        path: 'transactions',
        method: 'postTransactionsBuild',
        params: [data],
      }) as Promise<BuildTransactionResult>;

    this.transactions.postTransactionsDecodeUnsignedTx = async (
      data: DecodeUnsignedTx,
    ) =>
      this.request({
        path: 'transactions',
        method: 'postTransactionsDecodeUnsignedTx',
        params: [data],
      }) as Promise<DecodeUnsignedTxResult>;
  }

  override request = async ({ path, method, params }: ApiRequestArguments) => {
    const res = await this.backgroundApi.serviceAccountProfile.sendProxyRequest(
      {
        networkId: this.networkId,
        body: [
          {
            route: 'rpc',
            params: {
              path,
              method,
              params,
            },
          },
        ],
      },
    );
    return res?.[0];
  };
}
