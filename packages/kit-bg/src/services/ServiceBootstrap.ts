import { backgroundClass } from '@onekeyhq/shared/src/background/backgroundDecorators';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import '@onekeyhq/shared/src/storage/appStorage';
import systemTimeUtils from '@onekeyhq/shared/src/utils/systemTimeUtils';

import localDb from '../dbs/local/localDb';

import ServiceBase from './ServiceBase';

@backgroundClass()
class ServiceBootstrap extends ServiceBase {
  constructor({ backgroundApi }: { backgroundApi: any }) {
    super({ backgroundApi });
  }

  public async init() {
    await this.initCritical();
    void this.initDeferred();
  }

  private logTiming(label: string, startMs: number) {
    const elapsed = Date.now() - startMs;
    // eslint-disable-next-line no-console
    console.log(`[ServiceBootstrap] ${label}: ${elapsed}ms`);
  }

  private async timed<T>(label: string, fn: () => Promise<T>): Promise<T> {
    const start = Date.now();
    try {
      const result = await fn();
      this.logTiming(label, start);
      return result;
    } catch (error) {
      this.logTiming(`${label} (FAILED)`, start);
      throw error;
    }
  }

  /**
   * Critical init: only what's needed for DB readiness and RPC availability.
   * This runs during cold start and must complete before background is "ready".
   */
  public async initCritical() {
    const criticalStart = Date.now();
    await this.timed('localDb.readyDb', () => localDb.readyDb);
    try {
      await this.timed('initSystemLocale', () =>
        this.backgroundApi.serviceSetting.initSystemLocale(),
      );
    } catch (error) {
      console.error('ServiceBootstrap initCritical: locale error', error);
    }
    try {
      await this.timed('refreshLocaleMessages', () =>
        this.backgroundApi.serviceSetting.refreshLocaleMessages(),
      );
    } catch (error) {
      console.error(
        'ServiceBootstrap initCritical: locale messages error',
        error,
      );
    }
    this.logTiming('initCritical TOTAL', criticalStart);
  }

  /**
   * Deferred init: everything not needed for immediate RPC availability.
   * Runs after critical init completes. Individual failures are isolated
   * so they don't block other deferred tasks.
   */
  public async initDeferred() {
    const deferredStart = Date.now();
    try {
      await Promise.all([
        this.timed('walletConnect.initializeOnStart', () =>
          this.backgroundApi.walletConnect.initializeOnStart(),
        ).catch((e: unknown) =>
          console.error('walletConnect init error', e),
        ),
        this.timed('walletConnect.cleanupInactiveSessions', () =>
          this.backgroundApi.serviceWalletConnect.dappSide.cleanupInactiveSessions(),
        ).catch((e: unknown) =>
          console.error('walletConnect cleanup error', e),
        ),
        this.timed('serviceSwap.syncSwapHistoryPendingList', () =>
          this.backgroundApi.serviceSwap.syncSwapHistoryPendingList(),
        ).catch((e: unknown) => console.error('swap sync error', e)),
        this.timed('serviceSetting.fetchReviewControl', () =>
          this.backgroundApi.serviceSetting.fetchReviewControl(),
        ).catch((e: unknown) =>
          console.error('review control error', e),
        ),
        this.timed('servicePassword.addExtIntervalCheckLockStatusListener', () =>
          this.backgroundApi.servicePassword.addExtIntervalCheckLockStatusListener(),
        ).catch((e: unknown) =>
          console.error('lock status listener error', e),
        ),
        this.timed('serviceNotification.init', () =>
          this.backgroundApi.serviceNotification.init(),
        ).catch((e: unknown) =>
          console.error('notification init error', e),
        ),
        this.timed('serviceToken.clearLastActiveTabNameData', () =>
          this.backgroundApi.serviceToken.clearLastActiveTabNameData(),
        ).catch((e: unknown) =>
          console.error('clear tab name error', e),
        ),
      ]);
    } catch (error) {
      console.error('ServiceBootstrap initDeferred: batch error', error);
    }
    this.logTiming('initDeferred batch', deferredStart);

    // wait for local messages to be loaded
    void this.backgroundApi.serviceContextMenu.init();
    if (platformEnv.isExtension) {
      try {
        await this.backgroundApi.serviceDevSetting.initAnalytics();
      } catch (error) {
        console.error(error);
      }
    }
    void this.backgroundApi.serviceDevSetting.saveDevModeToSyncStorage();
    void this.backgroundApi.simpleDb.customTokens.migrateFromV1LegacyData();
    void this.backgroundApi.serviceAccount.migrateHdWalletsBackedUpStatus();
    void this.backgroundApi.serviceHistory.migrateFilterScamHistorySetting();
    void this.backgroundApi.serviceAccount.migrateHardwareLtcXPub();
    void this.backgroundApi.serviceSetting.migrateBTCFreshAddressSetting();
    void this.backgroundApi.serviceHardware.removeDeviceHomeScreen();
    void systemTimeUtils.startServerTimeInterval();
    void this.backgroundApi.serviceIpTable.init();
    void this.backgroundApi.serviceCloudBackupV2.init();
    // Restore persisted whitelist first, then fetch fresh data from server.
    // Sequencing prevents the stale persisted data from overwriting a newer fetch result.
    void this.backgroundApi.serviceSetting
      .restoreFiatPaySiteWhitelistFromPersist()
      .then(() =>
        this.backgroundApi.serviceSetting.fetchFiatPaySiteWhitelist(),
      );
    this.logTiming('initDeferred TOTAL', deferredStart);
  }
}

export default ServiceBootstrap;
