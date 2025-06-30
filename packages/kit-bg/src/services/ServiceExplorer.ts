import {
  backgroundClass,
  backgroundMethod,
} from '@onekeyhq/shared/src/background/backgroundDecorators';
import { ONEKEY_BLOCK_EXPLORER_URL } from '@onekeyhq/shared/src/config/appConfig';
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
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
    const { networkId } = params;
    void this.check(params);
    const network = await this.backgroundApi.serviceNetwork.getNetwork({
      networkId,
    });
    if (!network) {
      return '';
    }
    const type = params.type === 'transaction' ? 'tx' : params.type;
    const client = await this.getClient(EServiceEndpointEnum.Wallet);
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const oldUrl = client.getUri({
      url: `/v1/${network.code}/${type}/${params.param}`,
    });
    const newUrl = `${ONEKEY_BLOCK_EXPLORER_URL}/${network.code}/${type}/${params.param}`;
    return newUrl;
  }

  @backgroundMethod()
  async buildCustomEvmExplorerUrl(params: IBuildExplorerUrlParams) {
    const { networkId, type, param } = params;
    const isCustomNetwork =
      await this.backgroundApi.serviceNetwork.isCustomNetwork({
        networkId,
      });
    if (!isCustomNetwork) {
      throw new OneKeyLocalError('Only custom network is supported');
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
