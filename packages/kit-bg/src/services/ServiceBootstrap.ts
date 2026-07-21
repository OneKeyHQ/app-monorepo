import {
  backgroundClass,
  backgroundMethod,
} from '@onekeyhq/shared/src/background/backgroundDecorators';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import appStorage from '@onekeyhq/shared/src/storage/appStorage';
import {
  HOME_RUNTIME_PROTOCOL_VERSION,
  type IHomeRuntimeHandshake,
} from '@onekeyhq/shared/src/types/homeRuntime';
import {
  type IHomeOpaqueCacheEnvelope,
  isHomeOpaqueCacheEnvelope,
} from '@onekeyhq/shared/src/types/homeStoreCache';
import stringUtils from '@onekeyhq/shared/src/utils/stringUtils';
import systemTimeUtils from '@onekeyhq/shared/src/utils/systemTimeUtils';

import localDb from '../dbs/local/localDb';

import ServiceBase from './ServiceBase';

export function createHomeRuntimeProducerInstanceId(): string {
  return `home-bg-${stringUtils.generateUUID({ removeDashes: true })}`;
}

// One producer identity is shared by every ServiceBootstrap facade created in
// this background JS heap and changes only when that producer runtime restarts.
const HOME_RUNTIME_PRODUCER_INSTANCE_ID = createHomeRuntimeProducerInstanceId();
const HOME_STORE_CACHE_STORAGE_PREFIX = '$$home-store-cache-v1:';
const HOME_STORE_CACHE_INDEX_KEY = '$$home-store-cache-v1:index';
const HOME_STORE_CACHE_OWNER_LIMIT = 8;
let homeStoreCacheIndexQueue = Promise.resolve();

async function withHomeStoreCacheIndexLock<T>(
  task: () => Promise<T>,
): Promise<T> {
  const previous = homeStoreCacheIndexQueue;
  let release: () => void = () => undefined;
  homeStoreCacheIndexQueue = new Promise<void>((resolve) => {
    release = resolve;
  });
  await previous;
  try {
    return await task();
  } finally {
    release();
  }
}

@backgroundClass()
class ServiceBootstrap extends ServiceBase {
  constructor({ backgroundApi }: { backgroundApi: any }) {
    super({ backgroundApi });
  }

  public async init() {
    await this.initCritical();
    if (platformEnv.isWeb || platformEnv.isDesktop) {
      setTimeout(() => {
        void this.initDeferred();
      }, 6000);
      return;
    }
    void this.initDeferred();
  }

  @backgroundMethod()
  public async getHomeRuntimeHandshake(): Promise<IHomeRuntimeHandshake> {
    return {
      protocolVersion: HOME_RUNTIME_PROTOCOL_VERSION,
      producerInstanceId: HOME_RUNTIME_PRODUCER_INSTANCE_ID,
    };
  }

  @backgroundMethod()
  public async loadHomeStoreCache(
    key: string,
  ): Promise<IHomeOpaqueCacheEnvelope | undefined> {
    const raw = await appStorage.getItem(
      `${HOME_STORE_CACHE_STORAGE_PREFIX}${key}`,
    );
    if (!raw) {
      return undefined;
    }
    try {
      const envelope: unknown = JSON.parse(raw);
      return isHomeOpaqueCacheEnvelope(envelope) ? envelope : undefined;
    } catch {
      return undefined;
    }
  }

  @backgroundMethod()
  public async persistHomeStoreCache(
    envelope: IHomeOpaqueCacheEnvelope,
  ): Promise<boolean> {
    if (!isHomeOpaqueCacheEnvelope(envelope)) {
      return false;
    }
    return withHomeStoreCacheIndexLock(async () => {
      await appStorage.setItem(
        `${HOME_STORE_CACHE_STORAGE_PREFIX}${envelope.key}`,
        stringUtils.stableStringify(envelope),
      );
      const rawIndex = await appStorage.getItem(HOME_STORE_CACHE_INDEX_KEY);
      let index: string[] = [];
      if (rawIndex) {
        try {
          const parsed: unknown = JSON.parse(rawIndex);
          if (Array.isArray(parsed)) {
            index = parsed.filter(
              (value): value is string => typeof value === 'string',
            );
          }
        } catch {
          index = [];
        }
      }
      const nextIndex = [
        ...index.filter((key) => key !== envelope.key),
        envelope.key,
      ].slice(-HOME_STORE_CACHE_OWNER_LIMIT);
      const retiredKeys = index.filter((key) => !nextIndex.includes(key));
      await Promise.all(
        retiredKeys.map((key) =>
          appStorage.removeItem(`${HOME_STORE_CACHE_STORAGE_PREFIX}${key}`),
        ),
      );
      await appStorage.setItem(
        HOME_STORE_CACHE_INDEX_KEY,
        stringUtils.stableStringify(nextIndex),
      );
      return true;
    });
  }

  @backgroundMethod()
  public async removeHomeStoreCache(key: string): Promise<void> {
    await withHomeStoreCacheIndexLock(async () => {
      await appStorage.removeItem(`${HOME_STORE_CACHE_STORAGE_PREFIX}${key}`);
      const rawIndex = await appStorage.getItem(HOME_STORE_CACHE_INDEX_KEY);
      if (!rawIndex) {
        return;
      }
      try {
        const parsed: unknown = JSON.parse(rawIndex);
        if (!Array.isArray(parsed)) {
          return;
        }
        const nextIndex = parsed.filter(
          (value): value is string =>
            typeof value === 'string' && value !== key,
        );
        await appStorage.setItem(
          HOME_STORE_CACHE_INDEX_KEY,
          stringUtils.stableStringify(nextIndex),
        );
      } catch {
        await appStorage.removeItem(HOME_STORE_CACHE_INDEX_KEY);
      }
    });
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

    // Wallet backup-status diagnostics: sample the persisted appStatus raw
    // BEFORE any deferred task runs — several concurrent migrations below
    // write simpleDb.appStatus, and a sample taken after their setRawData
    // would misreport a freshly-created appStatus as pre-boot on-disk state.
    // Synchronous kick (the read is awaited later inside
    // migrateHdWalletsBackedUpStatus), so bootstrap is not delayed.
    this.backgroundApi.serviceAccount.startBackupMigrationBootRawSample();

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
      // ext MV3 only: re-warm providers of already-connected dapps after a
      // service-worker restart so notifyDApp* can reach them. Native/desktop
      // rebuild their webviews on restart (dapp reconnects), so no warmup
      // is needed there and it would just cost startup work.
      ...(platformEnv.isExtension
        ? [
            timedDeferred('serviceDApp.warmupConnectedDappProviders', () =>
              this.backgroundApi.serviceDApp.warmupConnectedDappProviders(),
            ),
          ]
        : []),
      timedDeferred('serviceDevSetting.saveDevModeToSyncStorage', () =>
        this.backgroundApi.serviceDevSetting.saveDevModeToSyncStorage(),
      ),
      timedDeferred('serviceDevSetting.syncNetworkThrottleSettings', () =>
        this.backgroundApi.serviceDevSetting.syncNetworkThrottleSettings(),
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
