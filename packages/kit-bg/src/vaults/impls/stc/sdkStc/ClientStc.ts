import type { IBackgroundApi } from '@onekeyhq/kit-bg/src/apis/IBackgroundApi';

function parseJsonFromRawResponse(response: Uint8Array): any {
  return JSON.parse(Buffer.from(response).toString());
}

function bytesJsonStringify(input: any): Buffer {
  return Buffer.from(JSON.stringify(input));
}

class ClientStc {
  private backgroundApi: IBackgroundApi;

  private networkId: string;

  constructor({
    backgroundApi,
    networkId,
  }: {
    backgroundApi: any;
    networkId: string;
  }) {
    this.networkId = networkId;
    this.backgroundApi = backgroundApi;
  }

  async callContract<T>({ method, params }: { method: string; params: any }) {
    const [result] =
      await this.backgroundApi.serviceAccountProfile.sendRpcProxyRequest<T>({
        networkId: this.networkId,
        body: [
          {
            route: 'rpc',
            params: {
              method: `contract.${method}`,
              params,
            },
          },
        ],
      });

    return result;
  }
}

export default ClientStc;
