import {
  backgroundClass,
  backgroundMethod,
} from '@onekeyhq/shared/src/background/backgroundDecorators';
import { EServiceEndpointEnum } from '@onekeyhq/shared/types/endpoint';
import type { IWalletBanner } from '@onekeyhq/shared/types/walletBanner';

import ServiceBase from './ServiceBase';

@backgroundClass()
class ServiceWalletBanner extends ServiceBase {
  constructor({ backgroundApi }: { backgroundApi: any }) {
    super({ backgroundApi });
  }

  @backgroundMethod()
  async fetchWalletBanner({ accountId }: { accountId?: string }) {
    const client = await this.backgroundApi.serviceGas.getClient(
      EServiceEndpointEnum.Utility,
    );
    const resp = await client.get<{ data: IWalletBanner[] }>(
      '/utility/v1/wallet-banner/list',
      {
        params: {},
        headers:
          await this.backgroundApi.serviceAccountProfile._getWalletTypeHeader({
            accountId,
          }),
      },
    );

    return resp.data.data;
  }

  @backgroundMethod()
  async updateClosedForeverBanners({
    bannerId,
    closedForever,
  }: {
    bannerId: string;
    closedForever: boolean;
  }) {
    await this.backgroundApi.simpleDb.walletBanner.updateClosedForeverBanners({
      bannerId,
      closedForever,
    });
  }

  @backgroundMethod()
  async getClosedForeverBanners() {
    return this.backgroundApi.simpleDb.walletBanner.getClosedForeverBanners();
  }
}

export default ServiceWalletBanner;
