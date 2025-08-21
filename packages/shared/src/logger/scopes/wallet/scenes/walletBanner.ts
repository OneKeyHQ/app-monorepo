import { BaseScene } from '../../../base/baseScene';
import { LogToServer } from '../../../base/decorators';

export class WalletBannerScene extends BaseScene {
  @LogToServer()
  public walletBannerViewed({ bannerId }: { bannerId: string }) {
    return {
      bannerId,
    };
  }

  @LogToServer()
  public walletBannerClicked({
    bannerId,
    type,
  }: {
    bannerId: string;
    type: 'jump' | 'close';
  }) {
    return {
      bannerId,
      type,
    };
  }
}
