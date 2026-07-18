import appGlobals from '@onekeyhq/shared/src/appGlobals';
import {
  backgroundClass,
  backgroundMethod,
} from '@onekeyhq/shared/src/background/backgroundDecorators';
import {
  isAvailable,
  logoutFromGoogleDrive,
} from '@onekeyhq/shared/src/cloudfs';
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import type { EEnterWay } from '@onekeyhq/shared/src/logger/scopes/dex';
import { appRestart } from '@onekeyhq/shared/src/modules3rdParty/appRestart';
import { EAppRestartMode } from '@onekeyhq/shared/src/modules3rdParty/appRestart/types';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import {
  ERootRoutes,
  ETabHomeRoutes,
  ETabRoutes,
} from '@onekeyhq/shared/src/routes';
import appStorage, {
  storageHub,
} from '@onekeyhq/shared/src/storage/appStorage';
import type { IOpenUrlRouteInfo } from '@onekeyhq/shared/src/utils/extUtils';
import extUtils from '@onekeyhq/shared/src/utils/extUtils';
import resetUtils from '@onekeyhq/shared/src/utils/resetUtils';
import timerUtils from '@onekeyhq/shared/src/utils/timerUtils';
import type { EServiceEndpointEnum } from '@onekeyhq/shared/types/endpoint';

import localDb from '../dbs/local/localDb';
import simpleDb from '../dbs/simple/simpleDb';
// eslint-disable-next-line @typescript-eslint/no-restricted-imports
import { v4appStorage } from '../migrations/v4ToV5Migration/v4appStorage';
// eslint-disable-next-line @typescript-eslint/no-restricted-imports
import v4dbHubs from '../migrations/v4ToV5Migration/v4dbHubs';
import { appIsLocked } from '../states/jotai/atoms';
import { devSettingsPersistAtom } from '../states/jotai/atoms/devSettings';

import ServiceBase from './ServiceBase';
import { biologyAuthUtils } from './ServicePassword/biologyAuthUtils';
import {
  EXTENSION_FOREGROUND_RESET_DEADLINE_MS,
  createExtensionForegroundConnectionTracker,
  prepareAndCommitExtensionForegrounds,
  quiesceExtensionForegrounds,
  resumeExtensionForegrounds,
} from './utils';

import type { IExtensionForegroundConnectionTracker } from './utils';
import type { ISimpleDBAppStatus } from '../dbs/simple/entity/SimpleDbEntityAppStatus';

const extensionForegroundPreWipeBarrierErrors = new WeakSet<Error>();

const buildExtensionForegroundPreWipeBarrierError = (message: string) => {
  const error = new OneKeyLocalError(message);
  extensionForegroundPreWipeBarrierErrors.add(error);
  return error;
};

@backgroundClass()
class ServiceApp extends ServiceBase {
  unlockJobIds: string[] = [];

  constructor({ backgroundApi }: { backgroundApi: any }) {
    super({ backgroundApi });
  }

  @backgroundMethod()
  async getEndpointInfo({ name }: { name: EServiceEndpointEnum }) {
    return this.getClientEndpointInfo(name);
  }

  @backgroundMethod()
  async restartApp(opts: { mode?: EAppRestartMode; reason?: string } = {}) {
    // restartApp() MUST be called from background in Ext, UI reload will close
    // whole Browser. The platform-specific routing (desktopApi reload,
    // chrome.runtime.reload, location.reload, BackgroundThread.restart for
    // native) lives inside `appRestart` so this method stays uniform.
    await appRestart({
      mode: opts.mode ?? EAppRestartMode.All,
      reason: opts.reason ?? 'serviceApp.restartApp',
    });
  }

  private async resetData(
    extensionForegroundResetAttempt = 0,
    preparedExtensionForegroundPorts = new Set<chrome.runtime.Port>(),
    extensionForegroundConnectionTracker?: IExtensionForegroundConnectionTracker,
    resetFailures: string[] = [],
  ): Promise<void> {
    // const v4migrationPersistData = await v4migrationPersistAtom.get();
    // const v4migrationAutoStartDisabled =
    //   v4migrationPersistData?.v4migrationAutoStartDisabled;
    // ----------------------------------------------

    const recordResetFailure = (step: string, error: unknown) => {
      console.error(`${step} error`, error);
      resetFailures.push(step);
    };

    let extensionForegroundPortIdsBeforeClear: string[] = [];
    const extensionForegroundRevisionBeforeClear =
      extensionForegroundConnectionTracker?.getRevision();
    let initialForegroundCommitFailed = false;
    let initialForegroundCommitError: unknown;
    let postCommitPrepareError: unknown;
    if (platformEnv.isExtensionBackground) {
      const initialBarrierDeadlineAt =
        Date.now() + EXTENSION_FOREGROUND_RESET_DEADLINE_MS;
      try {
        // Let writes that entered before this runtime's guard finish their
        // generation fence before asking the independent UI heaps to stop.
        await resetUtils.waitForResetSensitiveTasksToSettle();

        // Fail closed: no shared store is touched until every connected UI
        // has guarded its own heap and acknowledged the write barrier.
        extensionForegroundPortIdsBeforeClear =
          await quiesceExtensionForegrounds({
            acknowledgedPorts: preparedExtensionForegroundPorts,
            bridgeExtBg: this.backgroundApi.bridgeExtBg,
            deadlineAt: initialBarrierDeadlineAt,
          });
      } catch (error) {
        const message = `Extension foreground reset barrier failed: ${
          error instanceof Error ? error.message : 'unknown barrier error'
        }`;
        if (extensionForegroundResetAttempt === 0) {
          throw buildExtensionForegroundPreWipeBarrierError(message);
        }
        throw new OneKeyLocalError(message);
      }
      try {
        // PREPARE is reversible and only acquires/drains foreground leases.
        // Once every UI has acknowledged, COMMIT freezes timers and clears
        // their browser stores before the background touches shared data.
        extensionForegroundPortIdsBeforeClear =
          await prepareAndCommitExtensionForegrounds({
            bridgeExtBg: this.backgroundApi.bridgeExtBg,
            connectionTracker: extensionForegroundConnectionTracker,
            deadlineAt: initialBarrierDeadlineAt,
            preparedPorts: preparedExtensionForegroundPorts,
          });
      } catch (error) {
        // Some foregrounds may already have committed their local clear. Do
        // not resume or restart against an uncleared background store: record
        // the failure, guard any newly joined UI, and continue the full wipe.
        initialForegroundCommitFailed = true;
        initialForegroundCommitError = error;
        console.error('extensionForegrounds-initial-commit error', error);
        try {
          extensionForegroundPortIdsBeforeClear =
            await quiesceExtensionForegrounds({
              acknowledgedPorts: preparedExtensionForegroundPorts,
              bridgeExtBg: this.backgroundApi.bridgeExtBg,
              deadlineAt: initialBarrierDeadlineAt,
            });
        } catch (prepareError) {
          postCommitPrepareError = prepareError;
          console.error(
            'extensionForegrounds-post-commit-prepare error',
            prepareError,
          );
        }
      }
      defaultLogger.setting.page.clearDataStep('extensionForegrounds-quiesced');
    } else {
      await resetUtils.waitForResetSensitiveTasksToSettle();
    }
    // clean app storage
    try {
      await appStorage.clear();
    } catch (error) {
      recordResetFailure('appStorage.clear', error);
    }
    defaultLogger.setting.page.clearDataStep('appStorage-clear');

    // clean secure storage (WebAuth password)
    try {
      await biologyAuthUtils.deletePassword();
    } catch (error) {
      recordResetFailure('deleteWebAuthPassword', error);
    }

    try {
      appStorage.syncStorage.clearAll();
    } catch (error) {
      recordResetFailure('syncStorage.clearAll', error);
    }
    defaultLogger.setting.page.clearDataStep('syncStorage-clearAll');

    // Clean jotai MMKV per-key storage (separate instance from syncStorage)
    if (platformEnv.isNative) {
      try {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const { default: jotaiMMKV } =
          require('@onekeyhq/shared/src/storage/instance/jotaiMMKVStorageInstance') as typeof import('@onekeyhq/shared/src/storage/instance/jotaiMMKVStorageInstance');
        jotaiMMKV.clearAll();
      } catch (error) {
        recordResetFailure('jotaiMMKV.clearAll', error);
      }
      defaultLogger.setting.page.clearDataStep('jotaiMMKV-clearAll');
    }

    // Clean cold-start cache MMKV (contextAtom snapshot + SWR cache).
    // On native this is a synchronous MMKV wipe; on web/desktop the facade's
    // clearAll() schedules an async IDB clear, so we additionally await the
    // dedicated helper to ensure the IDB store is fully wiped before reload.
    try {
      if (platformEnv.isWeb || platformEnv.isDesktop) {
        // On web/desktop, coldStartCacheStorage.clearAll() only fires a
        // fire-and-forget resetColdStartCache(); calling it alongside the
        // awaitable helper spawns two concurrent resets that share a single
        // isClearing latch, so the first one's finally releases the lock while
        // the second is still mid-wipe — letting external writes resurrect
        // data before db.clear lands. Use only the awaitable path here.
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const { awaitColdStartCacheCleared } =
          require('@onekeyhq/shared/src/storage/instance/webColdStartStorage') as typeof import('@onekeyhq/shared/src/storage/instance/webColdStartStorage');
        await awaitColdStartCacheCleared();
      } else {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const { coldStartCacheStorage } =
          require('@onekeyhq/shared/src/storage/instance/syncStorageInstance') as typeof import('@onekeyhq/shared/src/storage/instance/syncStorageInstance');
        coldStartCacheStorage.clearAll();
      }
    } catch (error) {
      recordResetFailure('coldStartCacheStorage.clearAll', error);
    }
    defaultLogger.setting.page.clearDataStep('coldStartCache-clearAll');

    await timerUtils.wait(100);

    try {
      await v4appStorage.clear();
    } catch (error) {
      recordResetFailure('v4appStorage.clear', error);
    }
    defaultLogger.setting.page.clearDataStep('v4appStorage-clear');
    await timerUtils.wait(100);

    // WARNING:
    // After deleting the realm database on Android, it blocks the thread for about 300ms. Root cause unknown.
    // Therefore, do not add any Android-specific business logic after cleaning the realm db
    try {
      // clean local db
      await localDb.reset();
    } catch (error) {
      recordResetFailure('localDb.reset', error);
    }
    defaultLogger.setting.page.clearDataStep('localDb-reset');

    try {
      const isV4DbExist: boolean =
        await this.backgroundApi.serviceV4Migration.checkIfV4DbExist();
      if (isV4DbExist) {
        await v4dbHubs.v4localDb.reset();
        if (!platformEnv.isNativeAndroid) {
          await timerUtils.wait(600);
        }
      }
    } catch (error) {
      recordResetFailure('v4localDb.reset', error);
    }
    defaultLogger.setting.page.clearDataStep('v4localDb-reset');

    if (!platformEnv.isNative) {
      if (platformEnv.isRuntimeBrowser || platformEnv.isExtensionBackground) {
        try {
          const storageBuckets = (globalThis.navigator as INavigator)
            .storageBuckets;
          const names = await storageBuckets?.keys();
          if (names) {
            for (const name of names) {
              try {
                await storageBuckets?.delete(name);
              } catch (error) {
                recordResetFailure(`storageBuckets.delete:${name}`, error);
              }
            }
          }
        } catch (error) {
          recordResetFailure('storageBuckets.delete', error);
        }
        await timerUtils.wait(100);
        defaultLogger.setting.page.clearDataStep('storageBuckets-delete');
      }

      if (platformEnv.isRuntimeBrowser || platformEnv.isExtensionBackground) {
        const shouldDeleteAllOtherIndexedDBs = true;
        try {
          if (globalThis?.indexedDB && shouldDeleteAllOtherIndexedDBs) {
            const indexedDB = globalThis?.indexedDB;
            const deleteAllIndexedDBs = async () => {
              const dbNames: IDBDatabaseInfo[] =
                (await indexedDB?.databases?.()) || [];
              for (const { name } of dbNames) {
                if (name) {
                  try {
                    await new Promise<void>((resolve, reject) => {
                      const timer = setTimeout(() => {
                        reject(new Error(`deleteIndexedDB timeout: ${name}`));
                      }, 1000);

                      const deleteRequest = indexedDB?.deleteDatabase(name);
                      deleteRequest.onsuccess = () => {
                        clearTimeout(timer);
                        resolve();
                      };
                      deleteRequest.onerror = () => {
                        clearTimeout(timer);
                        reject(new Error(`deleteIndexedDB error: ${name}`));
                      };
                    });
                  } catch (error) {
                    recordResetFailure(`deleteIndexedDB:${name}`, error);
                  }
                }
              }
            };
            await deleteAllIndexedDBs();
          }
        } catch (error) {
          recordResetFailure('deleteAllIndexedDBs', error);
        }
        await timerUtils.wait(100);
        defaultLogger.setting.page.clearDataStep(
          'shouldDeleteAllOtherIndexedDBs',
        );
      }

      // clear localStorage/sessionStorage
      if (platformEnv.isRuntimeBrowser) {
        try {
          globalThis.localStorage.clear();
        } catch (error) {
          recordResetFailure('window.localStorage.clear', error);
        }
        try {
          globalThis.sessionStorage.clear();
        } catch (error) {
          recordResetFailure('window.sessionStorage.clear', error);
        }
      }

      if (platformEnv.isDesktop) {
        try {
          await globalThis.desktopApiProxy?.storage.storeClear();
        } catch (error) {
          recordResetFailure('desktopApi.storeClear', error);
        }
      }
    }

    if (platformEnv.isExtensionBackground) {
      const finalAckDeadlineAt =
        Date.now() + EXTENSION_FOREGROUND_RESET_DEADLINE_MS;
      let finalQuiesceError: unknown;
      try {
        await prepareAndCommitExtensionForegrounds({
          bridgeExtBg: this.backgroundApi.bridgeExtBg,
          connectionTracker: extensionForegroundConnectionTracker,
          deadlineAt: finalAckDeadlineAt,
          preparedPorts: preparedExtensionForegroundPorts,
        });
      } catch (error) {
        finalQuiesceError = error;
        console.error('extensionForegrounds-final-quiesce error', error);
      }

      if (finalQuiesceError) {
        if (extensionForegroundResetAttempt >= 2) {
          recordResetFailure(
            'extensionForegrounds-final-quiesce',
            finalQuiesceError,
          );
        } else {
          defaultLogger.setting.page.clearDataStep(
            'extensionForegrounds-final-quiesce-retry',
          );
          return this.resetData(
            extensionForegroundResetAttempt + 1,
            // Start each full re-wipe with fresh Port-object acknowledgements;
            // a replacement runtime may reuse the same bridge id.
            new Set<chrome.runtime.Port>(),
            extensionForegroundConnectionTracker,
            resetFailures,
          );
        }
      } else {
        if (
          initialForegroundCommitFailed &&
          extensionForegroundResetAttempt < 2
        ) {
          defaultLogger.setting.page.clearDataStep(
            'extensionForegrounds-initial-commit-rewipe',
          );
          return this.resetData(
            extensionForegroundResetAttempt + 1,
            new Set<chrome.runtime.Port>(),
            extensionForegroundConnectionTracker,
            resetFailures,
          );
        }
        if (initialForegroundCommitFailed) {
          recordResetFailure(
            'extensionForegrounds-initial-commit',
            initialForegroundCommitError,
          );
          if (postCommitPrepareError) {
            recordResetFailure(
              'extensionForegrounds-post-commit-prepare',
              postCommitPrepareError,
            );
          }
        }
        // Foregrounds clear window/session storage in their final COMMIT.
        // Clear extension-owned stores only after that barrier succeeds;
        // otherwise an unguarded foreground could rewrite behind this clear.
        try {
          await globalThis.chrome.storage.local.clear();
        } catch (error) {
          recordResetFailure('chrome.storage.local.clear', error);
        }
        try {
          await globalThis.chrome.storage.session.clear();
        } catch (error) {
          recordResetFailure('chrome.storage.session.clear', error);
        }
        let currentExtensionForegroundPortIds: string[] = [];
        let finalPortCheckError: unknown;
        try {
          currentExtensionForegroundPortIds = await quiesceExtensionForegrounds(
            {
              acknowledgedPorts: preparedExtensionForegroundPorts,
              bridgeExtBg: this.backgroundApi.bridgeExtBg,
              deadlineAt: finalAckDeadlineAt,
            },
          );
        } catch (error) {
          finalPortCheckError = error;
          console.error('extensionForegrounds-final-port-check error', error);
        }
        const portIdsBeforeClear = new Set(
          extensionForegroundPortIdsBeforeClear,
        );
        const foregroundJoinedWhileClearing =
          (extensionForegroundRevisionBeforeClear !== undefined &&
            extensionForegroundConnectionTracker?.getRevision() !==
              extensionForegroundRevisionBeforeClear) ||
          currentExtensionForegroundPortIds.some(
            (portId) => !portIdsBeforeClear.has(portId),
          );
        if (finalPortCheckError || foregroundJoinedWhileClearing) {
          if (extensionForegroundResetAttempt >= 2) {
            if (finalPortCheckError) {
              recordResetFailure(
                'extensionForegrounds-final-port-check',
                finalPortCheckError,
              );
            }
            if (foregroundJoinedWhileClearing) {
              recordResetFailure(
                'extensionForegrounds-kept-changing',
                new OneKeyLocalError(
                  'Extension foregrounds kept changing during Reset App',
                ),
              );
            }
          } else {
            defaultLogger.setting.page.clearDataStep(
              'extensionForegrounds-changed-retry',
            );
            return this.resetData(
              extensionForegroundResetAttempt + 1,
              new Set<chrome.runtime.Port>(),
              extensionForegroundConnectionTracker,
              resetFailures,
            );
          }
        }
      }
    }

    if (resetFailures.length > 0) {
      throw new OneKeyLocalError(
        `Reset App data clear failed: ${[...new Set(resetFailures)].join(', ')}`,
      );
    }
  }

  @backgroundMethod()
  async resetApp() {
    defaultLogger.prime.subscription.onekeyIdLogout({
      reason: 'ServiceApp.resetApp',
    });
    // logout supabase is called in UI hooks
    void this.backgroundApi.servicePrime.apiLogout();

    defaultLogger.setting.page.clearDataStep('servicePrime-apiLogout');
    void this.backgroundApi.serviceNotification.unregisterClient();
    defaultLogger.setting.page.clearDataStep(
      'serviceNotification-unregisterClient',
    );
    // logout from Google Drive
    if (platformEnv.isNativeAndroid && (await isAvailable())) {
      void logoutFromGoogleDrive(true);
      defaultLogger.setting.page.clearDataStep('logoutFromGoogleDrive');
    }
    await timerUtils.wait(1000);

    try {
      // Desktop/web can execute this service in the same JS runtime as the UI,
      // while native/extension use an independent bg heap. Each runtime keeps
      // the reset guard it owns until restart has quiesced that runtime; ending
      // it after resetData would let stale intervals rewrite shared native
      // storage while appRestart is still awaiting its pre-restart work.
      await resetUtils.runWithResettingGuard(async () => {
        defaultLogger.setting.page.clearDataStep('startResetting');
        let resetDataError: Error | undefined;
        let resetFailedBeforeStorageClear = false;
        const extensionForegroundConnectionTracker =
          platformEnv.isExtensionBackground
            ? createExtensionForegroundConnectionTracker()
            : undefined;
        const disposeExtensionForegroundConnectionTracker = () => {
          extensionForegroundConnectionTracker?.dispose();
        };
        try {
          defaultLogger.setting.page.clearDataStep('resetData-start');
          await this.resetData(
            0,
            new Set<chrome.runtime.Port>(),
            extensionForegroundConnectionTracker,
          );
          defaultLogger.setting.page.clearDataStep('resetData-end');
        } catch (e) {
          resetFailedBeforeStorageClear =
            e instanceof Error &&
            extensionForegroundPreWipeBarrierErrors.has(e);
          resetDataError =
            e instanceof Error
              ? e
              : new OneKeyLocalError('Reset App data clear failed');
          console.error('resetData error', e);
        }

        if (resetFailedBeforeStorageClear) {
          let resumeError: unknown;
          try {
            await resumeExtensionForegrounds({
              bridgeExtBg: this.backgroundApi.bridgeExtBg,
            });
          } catch (error) {
            resumeError = error;
            console.error('resumeExtensionForegrounds error', error);
          }
          disposeExtensionForegroundConnectionTracker();
          throw new OneKeyLocalError(
            [
              resetDataError?.message,
              resumeError instanceof Error ? resumeError.message : undefined,
            ]
              .filter(Boolean)
              .join('; '),
          );
        }

        if (
          !platformEnv.isNative &&
          (platformEnv.isWeb || platformEnv.isDesktop)
        ) {
          // reset route/href
          try {
            appGlobals.$navigationRef.current?.navigate(ERootRoutes.Main, {
              screen: ETabRoutes.Home,
              params: {
                screen: ETabHomeRoutes.TabHome,
              },
            });
          } catch {
            console.error('reset route error');
          }
          defaultLogger.setting.page.clearData({ action: 'ResetApp' });
          await timerUtils.wait(600);
        }

        // resetData wipes localDb / appStorage / v4 db — the background runtime
        // is now holding stale state and bundle moduleIds may have re-keyed via
        // OTA. mode=All forces both runtimes cold so nothing reads from the
        // dead state.
        try {
          await this.restartApp({
            mode: EAppRestartMode.All,
            reason: resetDataError ? 'auth.resetData.failed' : 'auth.resetData',
          });
        } catch (restartError) {
          let resumeError: unknown;
          if (platformEnv.isExtensionBackground) {
            try {
              await resumeExtensionForegrounds({
                bridgeExtBg: this.backgroundApi.bridgeExtBg,
              });
            } catch (error) {
              resumeError = error;
              console.error('resumeExtensionForegrounds error', error);
            }
          }
          disposeExtensionForegroundConnectionTracker();
          const failureMessages = [
            resetDataError?.message,
            restartError instanceof Error
              ? restartError.message
              : 'App restart failed',
            resumeError instanceof Error ? resumeError.message : undefined,
          ].filter(Boolean);
          throw new OneKeyLocalError(failureMessages.join('; '));
        }
        // chrome.runtime.reload() only schedules teardown. Keep the connection
        // tracker alive together with appRestart's retained reset lease until
        // Chrome destroys this background runtime. Disposing here would reopen
        // an unobserved connection window after the final port barrier.
        if (resetDataError) {
          throw new OneKeyLocalError(resetDataError.message);
        }
      });
    } finally {
      defaultLogger.setting.page.clearDataStep('endResetting');
    }
  }

  @backgroundMethod()
  async isAppLocked() {
    return appIsLocked.get();
  }

  @backgroundMethod()
  async dispatchUnlockJob() {
    defaultLogger.app.page.dispatchUnlockJob();
    appEventBus.emit(EAppEventBusNames.UnlockApp, undefined);
  }

  @backgroundMethod()
  async openExtensionExpandTab(routeInfo: IOpenUrlRouteInfo) {
    return extUtils.openExpandTab(routeInfo);
  }

  @backgroundMethod()
  async openExtensionMarketTokenDetail(params: {
    tokenAddress: string;
    network: string;
    isNative?: boolean;
    from?: EEnterWay;
    showFavoriteButton?: boolean;
  }) {
    const { tokenAddress, network, isNative, from, showFavoriteButton } =
      params;
    const routeParams: IOpenUrlRouteInfo['params'] = {};

    if (typeof isNative === 'boolean') {
      routeParams.isNative = isNative;
    }
    if (from) {
      routeParams.from = from;
    }
    if (typeof showFavoriteButton === 'boolean') {
      routeParams.showFavoriteButton = showFavoriteButton;
    }

    return extUtils.openExpandTab({
      path: `/market/token/${network}/${tokenAddress}`,
      params: routeParams,
    });
  }

  @backgroundMethod()
  async updateLaunchTimes() {
    await simpleDb.appStatus.setRawData(
      (v): ISimpleDBAppStatus => ({
        ...v,
        launchTimes: (v?.launchTimes ?? 0) + 1,
        launchTimesLastReset: (v?.launchTimesLastReset ?? 0) + 1,
      }),
    );
  }

  @backgroundMethod()
  async resetLaunchTimesAfterUpdate() {
    await simpleDb.appStatus.setRawData(
      (v): ISimpleDBAppStatus => ({
        ...v,
        launchTimesLastReset: 0,
      }),
    );
  }

  @backgroundMethod()
  async getLaunchTimesLastReset() {
    const v = await simpleDb.appStatus.getRawData();
    return v?.launchTimesLastReset ?? 0;
  }

  @backgroundMethod()
  async clearAppStorage() {
    const devSettings = await devSettingsPersistAtom.get();
    if (!devSettings.enabled) {
      throw new OneKeyLocalError(
        'clearAppStorage is only available when devSettings is enabled',
      );
    }

    try {
      // Clear appStorage (works for both web and native)
      await appStorage.clear();
      defaultLogger.setting.page.clearDataStep('appStorage-clear');
      return { success: true };
    } catch (error) {
      console.error('clearAppStorage error', error);
      throw error;
    }
  }

  @backgroundMethod()
  async clearSimpleDB() {
    const devSettings = await devSettingsPersistAtom.get();
    if (!devSettings.enabled) {
      throw new OneKeyLocalError(
        'clearSimpleDB is only available when devSettings is enabled',
      );
    }

    try {
      let clearedKeysCount = 0;

      if (platformEnv.isWeb || platformEnv.isDesktop) {
        // Web/Desktop: Clear the dedicated SimpleDB IndexedDB database
        const simpleDbStorage = storageHub.$webStorageSimpleDB;
        if (simpleDbStorage) {
          const allKeys = await simpleDbStorage.getAllKeys();
          clearedKeysCount = allKeys.length;
          await simpleDbStorage.clear();
        }
      } else {
        // Native: Filter and remove keys with simple_db_v5 prefix from appStorage
        const SIMPLE_DB_KEY_PREFIX = 'simple_db_v5';
        const allKeys = await appStorage.getAllKeys();
        const simpleDbKeys = allKeys.filter((key) =>
          key.startsWith(SIMPLE_DB_KEY_PREFIX),
        );

        if (simpleDbKeys.length > 0) {
          await appStorage.multiRemove(simpleDbKeys);
        }
        clearedKeysCount = simpleDbKeys.length;
      }

      defaultLogger.setting.page.clearDataStep('simpleDB-clear');
      return {
        success: true,
        clearedKeysCount,
      };
    } catch (error) {
      console.error('clearSimpleDB error', error);
      throw error;
    }
  }

  @backgroundMethod()
  async clearGlobalStatus() {
    const devSettings = await devSettingsPersistAtom.get();
    if (!devSettings.enabled) {
      throw new OneKeyLocalError(
        'clearGlobalStatus is only available when devSettings is enabled',
      );
    }

    try {
      let clearedKeysCount = 0;

      if (platformEnv.isWeb || platformEnv.isDesktop) {
        // Web/Desktop: Clear the dedicated GlobalStates IndexedDB database
        const globalStatesStorage = storageHub.$webStorageGlobalStates;
        if (globalStatesStorage) {
          const allKeys = await globalStatesStorage.getAllKeys();
          clearedKeysCount = allKeys.length;
          await globalStatesStorage.clear();
        }
      } else {
        // Native: Filter and remove keys with g_states_v5 prefix from appStorage
        const GLOBAL_STATES_KEY_PREFIX = 'g_states_v5';
        const allKeys = await appStorage.getAllKeys();
        const globalStatesKeys = allKeys.filter((key) =>
          key.startsWith(GLOBAL_STATES_KEY_PREFIX),
        );

        if (globalStatesKeys.length > 0) {
          await appStorage.multiRemove(globalStatesKeys);
        }
        clearedKeysCount = globalStatesKeys.length;
      }

      defaultLogger.setting.page.clearDataStep('globalStatus-clear');
      return {
        success: true,
        clearedKeysCount,
      };
    } catch (error) {
      console.error('clearGlobalStatus error', error);
      throw error;
    }
  }

  @backgroundMethod()
  async getAppStorageFirstItem() {
    const devSettings = await devSettingsPersistAtom.get();
    if (!devSettings.enabled) {
      throw new OneKeyLocalError(
        'getAppStorageFirstItem is only available when devSettings is enabled',
      );
    }

    try {
      const allKeys = await appStorage.getAllKeys();
      if (allKeys.length === 0) {
        return {
          isEmpty: true,
          key: null,
          value: null,
          totalKeys: 0,
        };
      }

      const firstKey = allKeys[0];
      const firstValue = await appStorage.getItem(firstKey);

      return {
        isEmpty: false,
        key: firstKey,
        value: firstValue,
        totalKeys: allKeys.length,
      };
    } catch (error) {
      console.error('getAppStorageFirstItem error', error);
      throw error;
    }
  }

  @backgroundMethod()
  async getSimpleDBFirstItem() {
    const devSettings = await devSettingsPersistAtom.get();
    if (!devSettings.enabled) {
      throw new OneKeyLocalError(
        'getSimpleDBFirstItem is only available when devSettings is enabled',
      );
    }

    try {
      let allKeys: readonly string[] = [];
      let storage: typeof appStorage | null = null;

      if (platformEnv.isWeb || platformEnv.isDesktop) {
        // Web/Desktop: Query from dedicated SimpleDB IndexedDB database
        const simpleDbStorage = storageHub.$webStorageSimpleDB;
        if (simpleDbStorage) {
          storage = simpleDbStorage;
          allKeys = await simpleDbStorage.getAllKeys();
        }
      } else {
        // Native: Filter keys with simple_db_v5 prefix from appStorage
        const SIMPLE_DB_KEY_PREFIX = 'simple_db_v5';
        const allAppStorageKeys = await appStorage.getAllKeys();
        allKeys = allAppStorageKeys.filter((key) =>
          key.startsWith(SIMPLE_DB_KEY_PREFIX),
        );
        storage = appStorage;
      }

      if (allKeys.length === 0 || !storage) {
        return {
          isEmpty: true,
          key: null,
          value: null,
          totalKeys: 0,
        };
      }

      const firstKey = allKeys[0];
      const firstValue = await storage.getItem(firstKey);

      return {
        isEmpty: false,
        key: firstKey,
        value: firstValue,
        totalKeys: allKeys.length,
      };
    } catch (error) {
      console.error('getSimpleDBFirstItem error', error);
      throw error;
    }
  }

  @backgroundMethod()
  async getGlobalStatusFirstItem() {
    const devSettings = await devSettingsPersistAtom.get();
    if (!devSettings.enabled) {
      throw new OneKeyLocalError(
        'getGlobalStatusFirstItem is only available when devSettings is enabled',
      );
    }

    try {
      let allKeys: readonly string[] = [];
      let storage: typeof appStorage | null = null;

      if (platformEnv.isWeb || platformEnv.isDesktop) {
        // Web/Desktop: Query from dedicated GlobalStates IndexedDB database
        const globalStatesStorage = storageHub.$webStorageGlobalStates;
        if (globalStatesStorage) {
          storage = globalStatesStorage;
          allKeys = await globalStatesStorage.getAllKeys();
        }
      } else {
        // Native: Filter keys with g_states_v5 prefix from appStorage
        const GLOBAL_STATES_KEY_PREFIX = 'g_states_v5';
        const allAppStorageKeys = await appStorage.getAllKeys();
        allKeys = allAppStorageKeys.filter((key) =>
          key.startsWith(GLOBAL_STATES_KEY_PREFIX),
        );
        storage = appStorage;
      }

      if (allKeys.length === 0 || !storage) {
        return {
          isEmpty: true,
          key: null,
          value: null,
          totalKeys: 0,
        };
      }

      const firstKey = allKeys[0];
      const firstValue = await storage.getItem(firstKey);

      return {
        isEmpty: false,
        key: firstKey,
        value: firstValue,
        totalKeys: allKeys.length,
      };
    } catch (error) {
      console.error('getGlobalStatusFirstItem error', error);
      throw error;
    }
  }
}

export default ServiceApp;
