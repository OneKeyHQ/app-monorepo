import RNRestart from 'react-native-restart';

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

import type { ISimpleDBAppStatus } from '../dbs/simple/entity/SimpleDbEntityAppStatus';

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
  async restartApp() {
    defaultLogger.setting.page.restartApp();
    if (platformEnv.isNative) {
      RNRestart.restart();
      return;
    }
    if (platformEnv.isDesktop) {
      return globalThis.desktopApiProxy?.system?.reload?.();
    }
    // restartApp() MUST be called from background in Ext, UI reload will close whole Browser
    if (platformEnv.isExtensionBackground) {
      return chrome.runtime.reload();
    }
    if (platformEnv.isRuntimeBrowser) {
      return globalThis?.location?.reload?.();
    }
  }

  private async resetData() {
    // const v4migrationPersistData = await v4migrationPersistAtom.get();
    // const v4migrationAutoStartDisabled =
    //   v4migrationPersistData?.v4migrationAutoStartDisabled;
    // ----------------------------------------------

    // clean app storage
    try {
      await appStorage.clear();
    } catch {
      console.error('appStorage.clear() error');
    }
    defaultLogger.setting.page.clearDataStep('appStorage-clear');

    // clean secure storage (WebAuth password)
    try {
      await biologyAuthUtils.deletePassword();
    } catch {
      console.error('deleteWebAuthPassword error');
    }

    try {
      appStorage.syncStorage.clearAll();
    } catch {
      console.error('syncStorage.clear() error');
    }
    defaultLogger.setting.page.clearDataStep('syncStorage-clearAll');
    await timerUtils.wait(100);

    try {
      await v4appStorage.clear();
    } catch {
      console.error('v4appStorage.clear() error');
    }
    defaultLogger.setting.page.clearDataStep('v4appStorage-clear');
    await timerUtils.wait(100);

    // WARNING:
    // After deleting the realm database on Android, it blocks the thread for about 300ms. Root cause unknown.
    // Therefore, do not add any Android-specific business logic after cleaning the realm db
    try {
      // clean local db
      await localDb.reset();
    } catch {
      console.error('localDb.reset() error');
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
    } catch (_error) {
      //
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
                console.error('storageBuckets.delete() error', error);
              }
            }
          }
        } catch {
          console.error('storageBuckets.delete() error');
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
                    console.error('deleteIndexedDB error', error);
                  }
                }
              }
            };
            await deleteAllIndexedDBs();
          }
        } catch (error) {
          console.error('deleteAllIndexedDBs error', error);
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
        } catch {
          console.error('window.localStorage.clear() error');
        }
        try {
          globalThis.sessionStorage.clear();
        } catch {
          console.error('window.sessionStorage.clear() error');
        }
      } else if (platformEnv.isExtensionBackground) {
        appEventBus.emit(EAppEventBusNames.ClearStorageOnExtension, undefined);
        await timerUtils.wait(1200);
      }

      if (platformEnv.isExtension) {
        try {
          await globalThis.chrome.storage.local.clear();
        } catch {
          console.error('chrome.storage.local.clear() error');
        }
        // try {
        //   await globalThis.chrome.storage.sync.clear();
        // } catch {
        //   console.error('chrome.storage.sync.clear() error');
        // }
        try {
          await globalThis.chrome.storage.session.clear();
        } catch {
          console.error('chrome.storage.session.clear() error');
        }
        // try {
        //   await globalThis.chrome.storage.managed.clear();
        // } catch {
        //   console.error('chrome.storage.managed.clear() error');
        // }
      }

      if (platformEnv.isDesktop) {
        try {
          await globalThis.desktopApiProxy?.storage.storeClear();
        } catch (error) {
          console.error('desktopApi.storeClear() error', error);
        }
      }
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

    resetUtils.startResetting();
    defaultLogger.setting.page.clearDataStep('startResetting');
    try {
      defaultLogger.setting.page.clearDataStep('resetData-start');
      await this.resetData();
      defaultLogger.setting.page.clearDataStep('resetData-end');
    } catch (e) {
      console.error('resetData error', e);
    } finally {
      resetUtils.endResetting();
      defaultLogger.setting.page.clearDataStep('endResetting');
    }

    if (!platformEnv.isNative && (platformEnv.isWeb || platformEnv.isDesktop)) {
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

    await this.restartApp();
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
