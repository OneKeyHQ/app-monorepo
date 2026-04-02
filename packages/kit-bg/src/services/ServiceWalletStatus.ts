import {
  backgroundClass,
  backgroundMethod,
} from '@onekeyhq/shared/src/background/backgroundDecorators';

import ServiceBase from './ServiceBase';

@backgroundClass()
class ServiceWalletStatus extends ServiceBase {
  constructor({ backgroundApi }: { backgroundApi: any }) {
    super({ backgroundApi });
  }

  @backgroundMethod()
  async updateWalletStatus({
    walletXfp,
    status,
  }: {
    walletXfp: string;
    status: {
      manuallyCloseReceiveBlock?: boolean;
      manuallyCloseReferralCodeBlock?: boolean;
      hasValue?: boolean;
    };
  }) {
    await this.backgroundApi.simpleDb.walletStatus.updateWalletStatus(
      walletXfp,
      status,
    );
  }

  @backgroundMethod()
  async getWalletStatus({ walletXfp }: { walletXfp: string }) {
    return this.backgroundApi.simpleDb.walletStatus.getWalletStatus({
      walletXfp,
    });
  }
}

export default ServiceWalletStatus;
