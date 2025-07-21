import {
  backgroundClass,
  backgroundMethod,
} from '@onekeyhq/shared/src/background/backgroundDecorators';
import { EServiceEndpointEnum } from '@onekeyhq/shared/types/endpoint';
import type { IFetchResponse } from '@onekeyhq/shared/types/swap/types';
import type { IWalletBannerResponse } from '@onekeyhq/shared/types/walletBanner';

import ServiceBase from './ServiceBase';

@backgroundClass()
class ServiceWalletBanner extends ServiceBase {
  constructor({ backgroundApi }: { backgroundApi: any }) {
    super({ backgroundApi });
  }

  @backgroundMethod()
  async fetchWalletBanner({ accountId }: { accountId?: string }) {
    const client = await this.backgroundApi.serviceGas.getClient(
      EServiceEndpointEnum.Wallet,
    );
    const resp = await client.get<IFetchResponse<IWalletBannerResponse>>(
      '/utility/v1/wallet-banner/list',
      {
        params: {},
        headers:
          await this.backgroundApi.serviceAccountProfile._getWalletTypeHeader({
            accountId,
          }),
      },
    );

    if (resp.data.code !== 0) {
      return {
        banners: [],
        categories: [],
      };
    }

    return resp.data.data;
  }
}

export default ServiceWalletBanner;
