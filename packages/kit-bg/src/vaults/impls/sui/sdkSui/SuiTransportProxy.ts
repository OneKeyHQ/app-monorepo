/* eslint-disable @typescript-eslint/no-unsafe-member-access */
import type { IBackgroundApi } from '@onekeyhq/kit-bg/src/apis/IBackgroundApi';

export class SuiTransportProxy {
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

  async fetch<T>(
    input: RequestInfo | URL,
    init?: RequestInit,
  ): Promise<Response> {
    const body = JSON.parse(init?.body as string);
    const id = body.id;
    const res: T[] =
      await this.backgroundApi.serviceAccountProfile.sendProxyRequest({
        networkId: this.networkId,
        body: [
          {
            route: 'rpc',
            params: JSON.parse(init?.body as string),
          },
        ],
      });

    const jsonRpcResponse = {
      jsonrpc: '2.0',
      result: res?.[0],
      id,
    };
    const responseData = JSON.stringify(jsonRpcResponse);

    return new Response(responseData, {
      status: 200,
      statusText: 'OK',
      headers: {
        'Content-Type': 'application/json',
      },
    });
  }
}
