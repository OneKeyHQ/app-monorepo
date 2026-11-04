import type { IWalletBanner } from '@onekeyhq/shared/types/walletBanner';

import { SimpleDbEntityBase } from '../base/SimpleDbEntityBase';

export interface IWalletBannerDBData {
  closedForever?: Record<string, boolean>; // key: bannerId, value: true
  topBanners?: IWalletBanner[];
}

export class SimpleDbEntityWalletBanner extends SimpleDbEntityBase<IWalletBannerDBData> {
  entityName = 'walletBanner';

  override enableCache = false;

  async getClosedForeverBanners() {
    const data = await this.getRawData();
    return data?.closedForever ?? {};
  }

  async updateClosedForeverBanners({
    bannerId,
    closedForever,
  }: {
    bannerId: string;
    closedForever: boolean;
  }) {
    await this.setRawData((data) => {
      const oldData = data ?? { closedForever: {} };
      if (!oldData.closedForever) {
        oldData.closedForever = {
          [bannerId]: closedForever,
        };
      } else {
        oldData.closedForever[bannerId] = closedForever;
      }
      return oldData;
    });
  }

  async getTopBanners() {
    const data = await this.getRawData();
    return data?.topBanners ?? [];
  }

  async updateTopBanners({ topBanners }: { topBanners: IWalletBanner[] }) {
    await this.setRawData((data) => {
      const oldData = data ?? { topBanners: [] };
      oldData.topBanners = topBanners;
      return oldData;
    });
  }
}
