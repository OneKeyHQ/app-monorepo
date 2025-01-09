import { backgroundClass } from '@onekeyhq/shared/src/background/backgroundDecorators';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import appStorage from '@onekeyhq/shared/src/storage/appStorage';
import { EAppSyncStorageKeys } from '@onekeyhq/shared/src/storage/syncStorageKeys';

import { devSettingsPersistAtom } from '../states/jotai/atoms';

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
      this.backgroundApi.servicePassword.addExtIntervalCheckLockStatusListener(),
      this.backgroundApi.serviceNotification.init(),
    ]);
    // wait for local messages to be loaded
    void this.backgroundApi.serviceContextMenu.init();
    if (platformEnv.isExtension) {
      await this.backgroundApi.serviceDevSetting.initAnalytics();
    }
    void this.saveDevModeToSyncStorage();
  }

  async saveDevModeToSyncStorage() {
    const devSettings = await devSettingsPersistAtom.get();
    appStorage.syncStorage.set(
      EAppSyncStorageKeys.onekey_developer_mode_enabled,
      !!devSettings.enabled,
    );
  }
}

export default ServiceBootstrap;
