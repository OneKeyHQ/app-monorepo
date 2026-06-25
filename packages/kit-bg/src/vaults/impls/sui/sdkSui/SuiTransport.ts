import type { IBackgroundApi } from '@onekeyhq/kit-bg/src/apis/IBackgroundApi';
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';

import type {
  JsonRpcTransport,
  JsonRpcTransportRequestOptions,
} from '@mysten/sui/jsonRpc';

export class OneKeySuiTransport implements JsonRpcTransport {
  backgroundApi: IBackgroundApi;

  networkId: string;

  constructor({
    backgroundApi,
    networkId,
  }: {
    backgroundApi: any;
    networkId: string;
  }) {
    this.backgroundApi = backgroundApi;
    this.networkId = networkId;
  }

  async request<T>(input: JsonRpcTransportRequestOptions): Promise<T> {
    const res: T[] =
      await this.backgroundApi.serviceAccountProfile.sendProxyRequest({
        networkId: this.networkId,
        body: [
          {
            route: 'rpc',
            params: {
              method: input.method,
              params: input.params,
            },
          },
        ],
      });
    const response = res?.[0];
    if (!response) {
      throw new OneKeyLocalError('No response received from the proxy');
    }

    return response;
  }

  async subscribe(): Promise<() => Promise<boolean>> {
    throw new OneKeyLocalError('Subscription not implemented');
  }
}
