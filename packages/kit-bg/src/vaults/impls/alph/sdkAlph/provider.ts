import { NodeProvider } from '@alephium/web3';

import type { IBackgroundApi } from '@onekeyhq/kit-bg/src/apis/IBackgroundApi';

import type { ApiRequestArguments, node } from '@alephium/web3';

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

    this.transactions.postTransactionsBuild = async (
      data: node.BuildTransaction,
    ) =>
      // eslint-disable-next-line @typescript-eslint/no-unsafe-return
      this.request({
        path: 'transactions',
        method: 'postTransactionsBuild',
        params: [data],
      }) as Promise<node.BuildTransactionResult>;

    this.contracts.postContractsUnsignedTxDeployContract = async (
      data: node.BuildDeployContractTx,
    ) =>
      // eslint-disable-next-line @typescript-eslint/no-unsafe-return
      this.request({
        path: 'contracts',
        method: 'postContractsUnsignedTxDeployContract',
        params: [data],
      }) as Promise<node.BuildDeployContractTxResult>;

    this.transactions.postTransactionsDecodeUnsignedTx = async (
      data: node.DecodeUnsignedTx,
    ) =>
      // eslint-disable-next-line @typescript-eslint/no-unsafe-return
      this.request({
        path: 'transactions',
        method: 'postTransactionsDecodeUnsignedTx',
        params: [data],
      }) as Promise<node.DecodeUnsignedTxResult>;

    this.contracts.postContractsUnsignedTxExecuteScript = async (
      data: node.BuildDeployContractTx,
    ) =>
      // eslint-disable-next-line @typescript-eslint/no-unsafe-return
      this.request({
        path: 'contracts',
        method: 'postContractsUnsignedTxExecuteScript',
        params: [data],
      }) as Promise<node.BuildDeployContractTxResult>;
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
