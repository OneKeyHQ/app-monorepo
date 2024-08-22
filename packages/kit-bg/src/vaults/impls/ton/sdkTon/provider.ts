import TonWeb from 'tonweb';

import type { IBackgroundApi } from '@onekeyhq/kit-bg/src/apis/IBackgroundApi';

export class Provider extends TonWeb.HttpProvider {
  backgroundApi: IBackgroundApi;

  networkId: string;

  constructor({
    backgroundApi,
    networkId,
  }: {
    backgroundApi: IBackgroundApi;
    networkId: string;
  }) {
    super();
    this.backgroundApi = backgroundApi;
    this.networkId = networkId;
  }

  override async send(method: string, params: any): Promise<Response> {
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
  }
}
