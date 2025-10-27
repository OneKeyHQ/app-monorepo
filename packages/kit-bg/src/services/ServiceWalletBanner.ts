import {
  backgroundClass,
  backgroundMethod,
} from '@onekeyhq/shared/src/background/backgroundDecorators';
import { memoizee } from '@onekeyhq/shared/src/utils/cacheUtils';
import timerUtils from '@onekeyhq/shared/src/utils/timerUtils';
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
    return this.fetchWalletBannerMemo({ accountId });
  }

  fetchWalletBannerMemo = memoizee(
    async ({ accountId }: { accountId?: string }) => {
      const client = await this.getClient(EServiceEndpointEnum.Utility);
      const resp = await client.get<{ data: IWalletBanner[] }>(
        '/utility/v1/wallet-banner/list',
        {
          params: {},
          headers:
            await this.backgroundApi.serviceAccountProfile._getWalletTypeHeader(
              {
                accountId,
              },
            ),
        },
      );

      return resp.data.data;
    },
    {
      promise: true,
      primitive: true,
      maxAge: timerUtils.getTimeDurationMs({ minute: 1 }),
      max: 3,
    },
  );

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
