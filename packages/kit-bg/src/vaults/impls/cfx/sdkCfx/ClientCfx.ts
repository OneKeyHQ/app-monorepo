import type { IBackgroundApi } from '@onekeyhq/kit-bg/src/apis/IBackgroundApi';

import type { ISdkCfxContract } from '../types';

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
      await this.backgroundApi.serviceAccountProfile.sendProxyRequest<{
        epochNumber: number;
        chainId: number;
        networkId: number;
      }>({
        networkId: this.networkId,
        body: [
          {
            route: 'conflux',
            params: {
              method: 'getStatus',
              params: {},
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
    const [result] =
      await this.backgroundApi.serviceAccountProfile.sendProxyRequest<{
        storageCollateralized: number;
      }>({
        networkId: this.networkId,
        body: [
          {
            route: 'conflux',
            params: {
              method: 'estimateGasAndCollateral',
              params,
            },
          },
        ],
      });

    return result;
  }

  async getCode(address: string) {
    const [result] =
      await this.backgroundApi.serviceAccountProfile.sendProxyRequest<string>({
        networkId: this.networkId,
        body: [
          {
            route: 'conflux',
            params: {
              method: 'getCode',
              params: [address],
            },
          },
        ],
      });

    return result;
  }

  async CRC20(address: string) {
    const [result] =
      await this.backgroundApi.serviceAccountProfile.sendProxyRequest<ISdkCfxContract>(
        {
          networkId: this.networkId,
          body: [
            {
              route: 'conflux',
              params: {
                method: 'CRC20',
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
