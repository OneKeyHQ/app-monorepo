import type { IBackgroundApi } from '@onekeyhq/kit-bg/src/apis/IBackgroundApi';

class ClientCfx {
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

  async getStatus() {
    const [result] =
      await this.backgroundApi.serviceAccountProfile.sendRpcProxyRequest<{
        epochNumber: number;
        chainId: number;
        networkId: number;
      }>({
        networkId: this.networkId,
        body: [
          {
            route: 'rpc',
            params: {
              method: 'cfx_getStatus',
              params: [],
            },
          },
        ],
      });

    return result;
  }

  async estimateGasAndCollateral(params: {
    from: string;
    to: string;
    value: string;
    data: string;
  }) {
    try {
      const [result] =
        await this.backgroundApi.serviceAccountProfile.sendRpcProxyRequest<{
          storageCollateralized: number;
        }>({
          networkId: this.networkId,
          body: [
            {
              route: 'rpc',
              params: {
                method: 'cfx_estimateGasAndCollateral',
                params: [params],
              },
            },
          ],
        });

      return result;
    } catch (e) {
      console.log(e);
      return {
        storageCollateralized: 0,
      };
    }
  }

  async getCode(address: string) {
    const [result] =
      await this.backgroundApi.serviceAccountProfile.sendRpcProxyRequest<string>(
        {
          networkId: this.networkId,
          body: [
            {
              route: 'rpc',
              params: {
                method: 'cfx_getCode',
                params: [address],
              },
            },
          ],
        },
      );

    return result;
  }
}

export default ClientCfx;
