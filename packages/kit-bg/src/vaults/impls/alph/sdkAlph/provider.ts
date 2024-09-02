import { NodeProvider } from '@alephium/web3';

import type { IBackgroundApi } from '@onekeyhq/kit-bg/src/apis/IBackgroundApi';

import type { ApiRequestArguments } from '@alephium/web3';

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
  }

  override request = async ({ method, params }: ApiRequestArguments) => {
    const res = await this.backgroundApi.serviceAccountProfile.sendProxyRequest(
      {
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
      },
    );
    return res?.[0] as Response;
  };
}
