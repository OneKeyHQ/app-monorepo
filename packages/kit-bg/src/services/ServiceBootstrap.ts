import { backgroundClass } from '@onekeyhq/shared/src/background/backgroundDecorators';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import '@onekeyhq/shared/src/storage/appStorage';
import {
  setTravelModePushSuppressed,
  travelModeManager,
} from '@onekeyhq/shared/src/travelMode';
import type { ITravelModeRuntimeProfile } from '@onekeyhq/shared/src/travelMode';
import { isNeverLockDuration } from '@onekeyhq/shared/src/utils/passwordUtils';
import systemTimeUtils from '@onekeyhq/shared/src/utils/systemTimeUtils';

import { travelModeDappRequestIngress } from '../apis/TravelModeDappRequestIngress';
import localDb from '../dbs/local/localDb';
import { runtimeWalletEffectAdapter } from '../runtime/RuntimeEnvironmentAdapter';
import {
  passwordAtom,
  passwordPersistAtom,
} from '../states/jotai/atoms/password';

import ServiceBase from './ServiceBase';
import {
  markIdentityRecoveryFailed,
  markIdentityRecoveryReady,
} from './ServiceIdentityExit/identityLifecycleMutex';
import { recoverInterruptedIdentityLifecycleOperations } from './ServiceIdentityExit/recoverInterruptedIdentityLifecycleOperations';
import { scheduleWalletProfileAnalyticsChecks } from './walletProfileAnalyticsScheduler';

@backgroundClass()
class ServiceBootstrap extends ServiceBase {
  private walletProfileAnalyticsChecksScheduled = false;

  constructor({ backgroundApi }: { backgroundApi: any }) {
    super({ backgroundApi });
  }

  public async init() {
    await this.initCritical();
    if (platformEnv.isNative || platformEnv.isDesktop) {
      void runtimeWalletEffectAdapter
        .run({
          operation: async () => {
            const { firmwareArtifactAdapter } =
              await import('./ServiceFirmwareUpdate/FirmwareUpdateRuntime');
            await firmwareArtifactAdapter.sweepOrphans();
          },
          onUnavailable: () => undefined,
        })
        .catch(() => {
          defaultLogger.app.bootstrap.initCriticalStep(
            'firmwareArtifactOrphanSweep (FAILED)',
            0,
          );
        });
    }
    if (platformEnv.isWeb || platformEnv.isDesktop) {
      setTimeout(() => {
        void this.initDeferred();
      }, 6000);
      return;
    }
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

  private async initRuntimeFoundation(
    runtimeProfile: ITravelModeRuntimeProfile,
  ): Promise<void> {
    await setTravelModePushSuppressed(
      runtimeProfile.walletEffects === 'suppressed',
    );
    await this.timed('localDb.readyDb', () => localDb.readyDb);
  }

  private async initStandardRuntimeCritical(): Promise<void> {
    if (platformEnv.isExtension || platformEnv.isDesktop) {
      let desktopAppSessionUnlocked: boolean | undefined;
      let hyperLiquidSessionRestored = false;
      let hyperLiquidSessionUnlocked = false;
      if (platformEnv.isDesktop) {
        try {
          desktopAppSessionUnlocked =
            await globalThis.desktopApiProxy.security.getAppSessionUnlocked();
        } catch (_error) {
          defaultLogger.app.bootstrap.initCriticalStep(
            'desktopAppSessionRestore (FAILED)',
            0,
          );
        }
      }
      try {
        const { restored, unlocked } =
          await localDb.restoreHyperLiquidAgentSecretSession();
        hyperLiquidSessionRestored = restored;
        hyperLiquidSessionUnlocked = unlocked;
      } catch (_error) {
        defaultLogger.app.bootstrap.initCriticalStep(
          'hyperLiquidAgentSessionRestore (FAILED)',
          0,
        );
      }
      try {
        const { appLockDuration } = await passwordPersistAtom.get();
        const shouldRestoreAppUnlock = platformEnv.isDesktop
          ? (desktopAppSessionUnlocked ?? hyperLiquidSessionUnlocked)
          : hyperLiquidSessionUnlocked;
        if (shouldRestoreAppUnlock && isNeverLockDuration(appLockDuration)) {
          await passwordAtom.set((value) => ({ ...value, unLock: true }));
        } else if (hyperLiquidSessionRestored) {
          await localDb.clearHyperLiquidAgentSecretSession();
        }
      } catch (_error) {
        defaultLogger.app.bootstrap.initCriticalStep(
          'appSessionUnlockRestore (FAILED)',
          0,
        );
      }
    }
    try {
      await this.timed('identityLifecycle.recoverInterruptedOperations', () =>
        recoverInterruptedIdentityLifecycleOperations(this.backgroundApi),
      );
      markIdentityRecoveryReady();
    } catch (_error) {
      markIdentityRecoveryFailed();
      defaultLogger.app.bootstrap.initCriticalStep(
        'identityRecovery (FAILED)',
        0,
      );
    }
    try {
      await this.timed(
        'serviceHardware.migrateExistingDeviceConnectProtocols',
        () =>
          this.backgroundApi.serviceHardware.migrateExistingDeviceConnectProtocols(),
      );
    } catch (_error) {
      defaultLogger.app.bootstrap.initCriticalStep(
        'hardwareConnectProtocolMigration (FAILED)',
        0,
      );
    }
  }

  private async initControlPlaneCritical(): Promise<void> {
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
  }

  /**
   * Critical init: only what's needed for DB readiness and RPC availability.
   * This runs during cold start and must complete before background is "ready".
   */
  public async initCritical() {
    defaultLogger.app.bootstrap.initCriticalStart();
    const criticalStart = Date.now();
    const runtimeProfile = await travelModeManager.getRuntimeProfile();
    await this.initRuntimeFoundation(runtimeProfile);

    if (runtimeProfile.kind === 'travel-mode') {
      markIdentityRecoveryReady();
      await this.initControlPlaneCritical();
      defaultLogger.app.bootstrap.initCriticalDone(Date.now() - criticalStart);
      return;
    }

    await this.initStandardRuntimeCritical();
    await this.initControlPlaneCritical();
    defaultLogger.app.bootstrap.initCriticalDone(Date.now() - criticalStart);
  }

  /**
   * Deferred init: everything not needed for immediate RPC availability.
   * Runs after critical init completes. Individual failures are isolated
   * so they don't block other deferred tasks.
   */
  public async initDeferred() {
    const deferredStart = Date.now();

    const runtimeProfile = await travelModeManager.getRuntimeProfile();
    if (runtimeProfile.walletEffects === 'suppressed') {
      // Switching Travel Mode restarts the app. This early return keeps
      // WalletConnect from being constructed, so no relay or listeners start.
      travelModeDappRequestIngress.installRequestBlackout();
      defaultLogger.app.bootstrap.initDeferredDone(Date.now() - deferredStart);
      return;
    }

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
        timedDeferred('serviceSetting.fetchInscriptionProtectionControl', () =>
          this.backgroundApi.serviceSetting.fetchInscriptionProtectionControl(),
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
        timedDeferred('serviceHardwarePortfolioSync.init', async () =>
          this.backgroundApi.serviceHardwarePortfolioSync.init(),
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
      timedDeferred('serviceDevSetting.initAnalytics', async () => {
        await this.backgroundApi.serviceDevSetting.initAnalytics();
        if (!this.walletProfileAnalyticsChecksScheduled) {
          this.walletProfileAnalyticsChecksScheduled = true;
          scheduleWalletProfileAnalyticsChecks(() =>
            timedDeferred(
              'serviceAccount.reportWalletProfileAnalyticsIfNeeded',
              () =>
                this.backgroundApi.serviceAccount.reportWalletProfileAnalyticsIfNeeded(),
            ),
          );
        }
      }),
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
      // Resume persisted tracking from the runtime that owns it. The dynamic
      // preflight keeps the full Unifold service out of an idle startup while
      // preserving recovery after this background runtime restarts.
      timedDeferred('serviceUnifoldDeposit.resumeDepositTracking', () =>
        import('./ServiceUnifoldDeposit/resumeUnifoldDepositTracking').then(
          ({ resumeUnifoldDepositTracking }) =>
            resumeUnifoldDepositTracking(this.backgroundApi),
        ),
      ),
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
      timedDeferred('serviceHardware.migrateClassicPinInputDefault', () =>
        this.backgroundApi.serviceHardware.migrateClassicPinInputDefault(),
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
