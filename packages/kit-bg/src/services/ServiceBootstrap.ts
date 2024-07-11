import { backgroundClass } from '@onekeyhq/shared/src/background/backgroundDecorators';

import ServiceBase from './ServiceBase';

@backgroundClass()
class ServiceBootstrap extends ServiceBase {
  constructor({ backgroundApi }: { backgroundApi: any }) {
    super({ backgroundApi });
  }

  public async init() {
    await this.backgroundApi.serviceSetting.initSystemLocale();
    await Promise.all([
      this.backgroundApi.serviceSetting.refreshLocaleMessages(),
      this.backgroundApi.walletConnect.initializeOnStart(),
      this.backgroundApi.serviceWalletConnect.dappSide.cleanupInactiveSessions(),
      this.backgroundApi.serviceSwap.syncSwapHistoryPendingList(),
      this.backgroundApi.serviceSetting.fetchReviewControl(),
    ]);
    // wait for local messages to be loaded
    void this.backgroundApi.serviceContextMenu.init();
  }
}

export default ServiceBootstrap;
