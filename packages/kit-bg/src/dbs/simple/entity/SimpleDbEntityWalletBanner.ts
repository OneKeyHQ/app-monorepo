import { SimpleDbEntityBase } from '../base/SimpleDbEntityBase';

export interface IWalletBanner {
  closedForever: Record<string, boolean>; // key: bannerId, value: true
}

export class SimpleDbEntityWalletBanner extends SimpleDbEntityBase<IWalletBanner> {
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
      oldData.closedForever[bannerId] = closedForever;
      return oldData;
    });
  }
}
