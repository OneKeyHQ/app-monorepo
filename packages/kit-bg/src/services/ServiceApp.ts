import RNRestart from 'react-native-restart';

import {
  backgroundClass,
  backgroundMethod,
} from '@onekeyhq/shared/src/background/backgroundDecorators';
import {
  isAvailable,
  logoutFromGoogleDrive,
} from '@onekeyhq/shared/src/cloudfs';
import type { IAppEventBusPayload } from '@onekeyhq/shared/src/eventBus/appEventBus';
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
import appStorage from '@onekeyhq/shared/src/storage/appStorage';
import type { IOpenUrlRouteInfo } from '@onekeyhq/shared/src/utils/extUtils';
import extUtils from '@onekeyhq/shared/src/utils/extUtils';
import resetUtils from '@onekeyhq/shared/src/utils/resetUtils';
import timerUtils from '@onekeyhq/shared/src/utils/timerUtils';

import localDb from '../dbs/local/localDb';
// eslint-disable-next-line @typescript-eslint/no-restricted-imports
import { v4appStorage } from '../migrations/v4ToV5Migration/v4appStorage';
// eslint-disable-next-line @typescript-eslint/no-restricted-imports
import v4dbHubs from '../migrations/v4ToV5Migration/v4dbHubs';

import ServiceBase from './ServiceBase';

@backgroundClass()
class ServiceApp extends ServiceBase {
  constructor({ backgroundApi }: { backgroundApi: any }) {
    super({ backgroundApi });
  }

  @backgroundMethod()
  restartApp() {
    if (platformEnv.isNative) {
      return RNRestart.restart();
    }
    if (platformEnv.isDesktop) {
      return globalThis.desktopApi?.reload?.();
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

    await timerUtils.wait(100);

    try {
      await v4appStorage.clear();
    } catch {
      console.error('v4appStorage.clear() error');
    }

    await timerUtils.wait(100);

    try {
      // clean local db
      await localDb.reset();
    } catch {
      console.error('localDb.reset() error');
    }

    // await this.backgroundApi.serviceV4Migration.saveAppStorageV4migrationAutoStartDisabled(
    //   {
    //     v4migrationAutoStartDisabled,
    //   },
    // );

    try {
      const isV4DbExist: boolean =
        await this.backgroundApi.serviceV4Migration.checkIfV4DbExist();
      if (isV4DbExist) {
        await v4dbHubs.v4localDb.reset();
        await timerUtils.wait(600);
      }
    } catch (error) {
      //
    }

    await timerUtils.wait(1500);

    if (platformEnv.isRuntimeBrowser) {
      try {
        globalThis.localStorage.clear();
      } catch {
        console.error('window.localStorage.clear() error');
      }
    }

    try {
      await this.backgroundApi.serviceNotification.unregisterClient();
    } catch (error) {
      //
    }

    if (platformEnv.isWeb || platformEnv.isDesktop) {
      // reset route/href
      try {
        globalThis.$navigationRef.current?.navigate(ERootRoutes.Main, {
          screen: ETabRoutes.Home,
          params: {
            screen: ETabHomeRoutes.TabHome,
          },
        });
      } catch {
        console.error('reset route error');
      }
    }

    // logout from Google Drive
    if (platformEnv.isNativeAndroid && (await isAvailable())) {
      try {
        await logoutFromGoogleDrive(true);
      } catch {
        console.error('logoutFromGoogleDrive error');
      }
      await timerUtils.wait(1000);
    }
  }

  @backgroundMethod()
  async resetApp() {
    resetUtils.startResetting();
    try {
      await this.resetData();
    } catch (e) {
      console.error('resetData error', e);
    } finally {
      resetUtils.endResetting();
    }
    defaultLogger.setting.page.clearData({ action: 'ResetApp' });
    await timerUtils.wait(600);

    this.restartApp();
  }

  @backgroundMethod()
  async showToast(params: IAppEventBusPayload[EAppEventBusNames.ShowToast]) {
    appEventBus.emit(EAppEventBusNames.ShowToast, params);
  }

  @backgroundMethod()
  async openExtensionExpandTab(routeInfo: IOpenUrlRouteInfo) {
    await extUtils.openExpandTab(routeInfo);
  }
}

export default ServiceApp;
