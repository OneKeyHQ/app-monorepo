import { backgroundClass } from '@onekeyhq/shared/src/background/backgroundDecorators';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
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

  private async timed<T>(label: string, fn: () => Promise<T>): Promise<T> {
    const start = Date.now();
    try {
      const result = await fn();
      return result;
    } finally {
      const durationMs = Date.now() - start;
      defaultLogger.app.bootstrap.initCriticalStep(label, durationMs);
    }
  }

  /**
   * Critical init: only what's needed for DB readiness and RPC availability.
   * This runs during cold start and must complete before background is "ready".
   */
  public async initCritical() {
    defaultLogger.app.bootstrap.initCriticalStart();
    const criticalStart = Date.now();
    await this.timed('localDb.readyDb', () => localDb.readyDb);
    try {
      await this.timed('initSystemLocale', () =>
        this.backgroundApi.serviceSetting.initSystemLocale(),
      );
    } catch (_error) {
      defaultLogger.app.bootstrap.initCriticalStep(
        'initSystemLocale (FAILED)',
        0,
      );
    }
    try {
      await this.timed('refreshLocaleMessages', () =>
        this.backgroundApi.serviceSetting.refreshLocaleMessages(),
      );
    } catch (_error) {
      defaultLogger.app.bootstrap.initCriticalStep(
        'refreshLocaleMessages (FAILED)',
        0,
      );
    }
    defaultLogger.app.bootstrap.initCriticalDone(Date.now() - criticalStart);
  }

  /**
   * Deferred init: everything not needed for immediate RPC availability.
   * Runs after critical init completes. Individual failures are isolated
   * so they don't block other deferred tasks.
   */
  public async initDeferred() {
    const deferredStart = Date.now();

    const timedDeferred = async (label: string, fn: () => Promise<unknown>) => {
      const start = Date.now();
      try {
        await fn();
        defaultLogger.app.bootstrap.initDeferredStep(label, Date.now() - start);
      } catch (_e: unknown) {
        defaultLogger.app.bootstrap.initDeferredStepFailed(
          label,
          Date.now() - start,
        );
      }
    };

    try {
      await Promise.all([
        timedDeferred('walletConnect.initializeOnStart', () =>
          this.backgroundApi.walletConnect.initializeOnStart(),
        ),
        timedDeferred('walletConnect.cleanupInactiveSessions', () =>
          this.backgroundApi.serviceWalletConnect.dappSide.cleanupInactiveSessions(),
        ),
        timedDeferred('serviceSwap.seedSwapHistoryPreviewRead', () =>
          this.backgroundApi.serviceSwap.seedSwapHistoryPreviewReadIfNeeded(),
        ),
        timedDeferred('serviceSwap.syncSwapHistoryPendingList', () =>
          this.backgroundApi.serviceSwap.syncSwapHistoryPendingList(),
        ),
        timedDeferred('serviceSetting.fetchReviewControl', () =>
          this.backgroundApi.serviceSetting.fetchReviewControl(),
        ),
        timedDeferred(
          'servicePassword.addExtIntervalCheckLockStatusListener',
          () =>
            this.backgroundApi.servicePassword.addExtIntervalCheckLockStatusListener(),
        ),
        timedDeferred('serviceNotification.init', () =>
          this.backgroundApi.serviceNotification.init(),
        ),
        timedDeferred('serviceToken.clearLastActiveTabNameData', () =>
          this.backgroundApi.serviceToken.clearLastActiveTabNameData(),
        ),
      ]);
    } catch (_error) {
      // individual errors already handled by timedDeferred
    }
    defaultLogger.app.bootstrap.initDeferredBatchDone(
      Date.now() - deferredStart,
    );

    // Fire-and-forget tasks — each wrapped for error isolation and timing.
    // These are intentionally not awaited; individual timedDeferred logs
    // record each task's duration independently.
    const fireAndForgetTasks = [
      timedDeferred('serviceContextMenu.init', () =>
        this.backgroundApi.serviceContextMenu.init(),
      ),
      timedDeferred('serviceDevSetting.initAnalytics', () =>
        this.backgroundApi.serviceDevSetting.initAnalytics(),
      ),
      timedDeferred('serviceDevSetting.saveDevModeToSyncStorage', () =>
        this.backgroundApi.serviceDevSetting.saveDevModeToSyncStorage(),
      ),
      timedDeferred('serviceDevSetting.syncCryptoSettings', () =>
        this.backgroundApi.serviceDevSetting.syncCryptoSettings(),
      ),
      timedDeferred('customTokens.migrateFromV1LegacyData', () =>
        this.backgroundApi.simpleDb.customTokens.migrateFromV1LegacyData(),
      ),
      timedDeferred('accountValue.migrateToAddressKey', () =>
        this.backgroundApi.simpleDb.accountValue.migrateFromAccountIdToAddressKey(
          { serviceAccount: this.backgroundApi.serviceAccount },
        ),
      ),
      timedDeferred('serviceAccount.migrateHdWalletsBackedUpStatus', () =>
        this.backgroundApi.serviceAccount.migrateHdWalletsBackedUpStatus(),
      ),
      timedDeferred('serviceHistory.migrateFilterScamHistorySetting', () =>
        this.backgroundApi.serviceHistory.migrateFilterScamHistorySetting(),
      ),
      timedDeferred('serviceAccount.migrateHardwareLtcXPub', () =>
        this.backgroundApi.serviceAccount.migrateHardwareLtcXPub(),
      ),
      timedDeferred('serviceSetting.migrateBTCFreshAddressSetting', () =>
        this.backgroundApi.serviceSetting.migrateBTCFreshAddressSetting(),
      ),
      timedDeferred('serviceReferralCode.migrateCreationRecordsIfNeeded', () =>
        this.backgroundApi.serviceReferralCode.migrateCreationRecordsIfNeeded(),
      ),
      timedDeferred('serviceHardware.removeDeviceHomeScreen', () =>
        this.backgroundApi.serviceHardware.removeDeviceHomeScreen(),
      ),
      timedDeferred('systemTimeUtils.startServerTimeInterval', async () => {
        systemTimeUtils.startServerTimeInterval();
      }),
      timedDeferred('serviceIpTable.init', () =>
        this.backgroundApi.serviceIpTable.init(),
      ),
      timedDeferred('serviceCloudBackupV2.init', () =>
        this.backgroundApi.serviceCloudBackupV2.init(),
      ),
      timedDeferred('serviceSetting.restoreFiatPaySiteWhitelist', () =>
        this.backgroundApi.serviceSetting
          .restoreFiatPaySiteWhitelistFromPersist()
          .then(() =>
            this.backgroundApi.serviceSetting.fetchFiatPaySiteWhitelist(),
          ),
      ),
    ];
    // Wait for all fire-and-forget tasks to settle so initDeferredDone
    // reflects actual total deferred init time (#26).
    await Promise.allSettled(fireAndForgetTasks);
    defaultLogger.app.bootstrap.initDeferredDone(Date.now() - deferredStart);
  }
}

export default ServiceBootstrap;
