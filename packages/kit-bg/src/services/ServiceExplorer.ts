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
    const client = await this.getClient(EServiceEndpointEnum.Wallet);
    const { networkId, ...rest } = params;
    void this.check(params);
    return client.getUri({
      url: `/wallet/v1/network/explorer/${networkId}`,
      params: rest,
    });
  }
}

export default ServiceExplorer;
