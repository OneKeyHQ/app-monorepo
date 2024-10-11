import {
  backgroundClass,
  backgroundMethod,
} from '@onekeyhq/shared/src/background/backgroundDecorators';
import { EServiceEndpointEnum } from '@onekeyhq/shared/types/endpoint';
import type { IBuildExplorerUrlParams } from '@onekeyhq/shared/types/explorer';

import ServiceBase from './ServiceBase';

@backgroundClass()
class ServiceExplorer extends ServiceBase {
  constructor({ backgroundApi }: { backgroundApi: any }) {
    super({ backgroundApi });
  }

  private async check(params: IBuildExplorerUrlParams) {
    const client = await this.getClient(EServiceEndpointEnum.Wallet);
    const { networkId, ...rest } = params;
    void client.get(`/wallet/v1/network/explorer-check/${networkId}`, {
      params: rest,
    });
  }

  @backgroundMethod()
  async buildExplorerUrl(params: IBuildExplorerUrlParams) {
    const isCustomNetwork =
      await this.backgroundApi.serviceNetwork.isCustomNetwork({
        networkId: params.networkId,
      });
    if (isCustomNetwork) {
      return this.buildCustomEvmExplorerUrl(params);
    }
    const client = await this.getClient(EServiceEndpointEnum.Wallet);
    const { networkId, ...rest } = params;
    void this.check(params);
    return client.getUri({
      url: `/wallet/v1/network/explorer/${networkId}`,
      params: rest,
    });
  }

  @backgroundMethod()
  async buildCustomEvmExplorerUrl(params: IBuildExplorerUrlParams) {
    const { networkId, type, param } = params;
    const isCustomNetwork =
      await this.backgroundApi.serviceNetwork.isCustomNetwork({
        networkId,
      });
    if (!isCustomNetwork) {
      throw new Error('Only custom network is supported');
    }
    const network = await this.backgroundApi.serviceNetwork.getNetwork({
      networkId,
    });
    let { explorerURL } = network;
    if (!explorerURL) {
      return '';
    }
    explorerURL = explorerURL.replace(/\/+$/, '');
    switch (type) {
      case 'address':
        return `${explorerURL}/address/${param}`;
      case 'token':
        return `${explorerURL}/token/${param}`;
      case 'transaction':
        return `${explorerURL}/tx/${param}`;
      case 'block':
        return `${explorerURL}/block/${param}`;
      default:
        return explorerURL;
    }
  }
}

export default ServiceExplorer;
