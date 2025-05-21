import { backgroundClass } from '@onekeyhq/shared/src/background/backgroundDecorators';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import appStorage from '@onekeyhq/shared/src/storage/appStorage';
import { EAppSyncStorageKeys } from '@onekeyhq/shared/src/storage/syncStorageKeys';
import systemTimeUtils from '@onekeyhq/shared/src/utils/systemTimeUtils';

import localDb from '../dbs/local/localDb';
import { devSettingsPersistAtom } from '../states/jotai/atoms';

import ServiceBase from './ServiceBase';

@backgroundClass()
class ServiceBootstrap extends ServiceBase {
  constructor({ backgroundApi }: { backgroundApi: any }) {
    super({ backgroundApi });
  }

  public async init() {
    await localDb.readyDb;
    try {
      await this.backgroundApi.serviceSetting.initSystemLocale();
    } catch (error) {
      console.error(error);
    }
    try {
      await Promise.all([
        this.backgroundApi.serviceSetting.refreshLocaleMessages(),
        this.backgroundApi.walletConnect.initializeOnStart(),
        this.backgroundApi.serviceWalletConnect.dappSide.cleanupInactiveSessions(),
        this.backgroundApi.serviceSwap.syncSwapHistoryPendingList(),
        this.backgroundApi.serviceSetting.fetchReviewControl(),
        this.backgroundApi.servicePassword.addExtIntervalCheckLockStatusListener(),
        this.backgroundApi.serviceNotification.init(),
        this.backgroundApi.serviceReferralCode.fetchPostConfig(),
      ]);
    } catch (error) {
      console.error(error);
    }
    // wait for local messages to be loaded
    void this.backgroundApi.serviceContextMenu.init();
    if (platformEnv.isExtension) {
      try {
        await this.backgroundApi.serviceDevSetting.initAnalytics();
      } catch (error) {
        console.error(error);
      }
    }
    void this.saveDevModeToSyncStorage();
    void this.backgroundApi.serviceHardware.init();
    void this.backgroundApi.simpleDb.customTokens.migrateFromV1LegacyData();
    void this.backgroundApi.serviceAccount.migrateHdWalletsBackedUpStatus();
    void this.backgroundApi.serviceHistory.migrateFilterScamHistorySetting();
    void systemTimeUtils.startServerTimeInterval();
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
