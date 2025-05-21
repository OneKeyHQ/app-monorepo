import {
  backgroundClass,
  backgroundMethod,
} from '@onekeyhq/shared/src/background/backgroundDecorators';
import { generateLocalIndexedIdFunc } from '@onekeyhq/shared/src/utils/miscUtils';
import { EServiceEndpointEnum } from '@onekeyhq/shared/types/endpoint';
import type { IMarketTokenDetail } from '@onekeyhq/shared/types/marketV2';

import ServiceBase from './ServiceBase';

@backgroundClass()
class ServiceMarketV2 extends ServiceBase {
  constructor({ backgroundApi }: { backgroundApi: any }) {
    super({ backgroundApi });
  }

  @backgroundMethod()
  async fetchMarketTokenDetailByTokenAddress(
    tokenAddress: string,
    networkId: string,
  ) {
    const client = await this.getClient(EServiceEndpointEnum.Utility);
    const response = await client.get<{
      data: {
        token: IMarketTokenDetail;
      };
    }>('/utility/v2/market/token/detail', {
      params: {
        tokenAddress,
        networkId,
      },
    });
    const { data } = response.data;
    return data.token;
  }
}

export default ServiceMarketV2;
