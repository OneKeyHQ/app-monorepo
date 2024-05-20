import { JsonRpcClient } from '@mysten/sui.js'; // Update with the correct path

import type { IBackgroundApi } from '@onekeyhq/kit-bg/src/apis/IBackgroundApi';

export class SuiJsonRpcClient extends JsonRpcClient {
  backgroundApi: IBackgroundApi;

  networkId: string;

  constructor({
    backgroundApi,
    networkId,
  }: {
    backgroundApi: any;
    networkId: string;
  }) {
    super('');
    this.backgroundApi = backgroundApi;
    this.networkId = networkId;
  }

  override async request<T>(method: string, args: any): Promise<any> {
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

    return {
      jsonrpc: '2.0',
      id: new Date().getTime().toString(),
      result: response,
    };
  }
}
