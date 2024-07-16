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
      return window.desktopApi?.reload?.();
    }
    // restartApp() MUST be called from background in Ext, UI reload will close whole Browser
    if (platformEnv.isExtensionBackground) {
      return chrome.runtime.reload();
    }
    if (platformEnv.isRuntimeBrowser) {
      return window?.location?.reload?.();
    }
  }

  private async resetData() {
    // clean app storage
    await appStorage.clear();
    await v4appStorage.clear();

    // clean local db
    await localDb.reset();
    await timerUtils.wait(1500);

    if (platformEnv.isRuntimeBrowser) {
      try {
        global.localStorage.clear();
      } catch {
        console.error('window.localStorage.clear() error');
      }
    }

    if (platformEnv.isWeb || platformEnv.isDesktop) {
      // reset route/href
      try {
        global.$navigationRef.current?.navigate(ERootRoutes.Main, {
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
      await logoutFromGoogleDrive(true);
      await timerUtils.wait(1000);
    }
  }

  @backgroundMethod()
  async resetApp() {
    // const v4migrationPersistData = await v4migrationPersistAtom.get();
    // const v4migrationAutoStartDisabled =
    //   v4migrationPersistData?.v4migrationAutoStartDisabled;

    resetUtils.startResetting();
    try {
      await this.resetData();
    } catch (e) {
      console.error('resetData error', e);
    } finally {
      resetUtils.endResetting();
    }

    await timerUtils.wait(600);

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
