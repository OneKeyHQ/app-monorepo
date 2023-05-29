import { NativeModules } from 'react-native';
import RNRestart from 'react-native-restart';

import simpleDb from '@onekeyhq/engine/src/dbs/simple/simpleDb';
import { switchTestEndpoint } from '@onekeyhq/engine/src/endpoint';
import { RootRoutes } from '@onekeyhq/kit/src/routes/routesEnum';
import {
  passwordSet,
  release,
  setHandOperatedLock,
} from '@onekeyhq/kit/src/store/reducers/data';
import { setActiveIds } from '@onekeyhq/kit/src/store/reducers/general';
import {
  setEnableAppLock,
  setEnableLocalAuthentication,
} from '@onekeyhq/kit/src/store/reducers/settings';
import {
  lock,
  setBoardingCompleted,
  unlock,
} from '@onekeyhq/kit/src/store/reducers/status';
import type { OpenUrlRouteInfo } from '@onekeyhq/kit/src/utils/extUtils';
import extUtils from '@onekeyhq/kit/src/utils/extUtils';
import {
  getTimeDurationMs,
  getTimeStamp,
  wait,
} from '@onekeyhq/kit/src/utils/helper';
import {
  getPassword,
  hasHardwareSupported,
} from '@onekeyhq/kit/src/utils/localAuthentication';
import appUpdates from '@onekeyhq/kit/src/utils/updates/AppUpdates';
import {
  backgroundClass,
  backgroundMethod,
} from '@onekeyhq/shared/src/background/backgroundDecorators';
import {
  MAX_LOG_LENGTH,
  waitForDataLoaded,
} from '@onekeyhq/shared/src/background/backgroundUtils';
import {
  isAvailable,
  logoutFromGoogleDrive,
} from '@onekeyhq/shared/src/cloudfs';
import {
  AppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
import debugLogger from '@onekeyhq/shared/src/logger/debugLogger';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import appStorage from '@onekeyhq/shared/src/storage/appStorage';
import timerUtils from '@onekeyhq/shared/src/utils/timerUtils';

import ServiceBase from './ServiceBase';

import type { IServiceBaseProps } from './ServiceBase';

const { NativeAppRestart } = NativeModules;
@backgroundClass()
class ServiceApp extends ServiceBase {
  private _appInited = false;

  private interval?: ReturnType<typeof setInterval>;

  constructor(props: IServiceBaseProps) {
    super(props);
    this.initAppAfterStoreReady();
    if (platformEnv.isExtensionBackground) {
      this.autoOpenOnboardingIfExtensionInstalled();
      this.interval = setInterval(() => this.checkLockStatus(1), 60 * 1000);
    }
    // TODO recheck last reset status and resetApp here
  }

  get isAppInited() {
    return this._appInited;
  }

  @backgroundMethod()
  async waitForAppInited({ logName }: { logName: string }) {
    await waitForDataLoaded({
      logName: `waitForAppInited @ ${logName}`,
      data: () => this.isAppInited,
      wait: 300,
      timeout: getTimeDurationMs({ minute: 1 }),
    });
  }

  logger: string[] = [];

  @backgroundMethod()
  async getLoggerInstance() {
    return Promise.resolve(this.logger);
  }

  @backgroundMethod()
  async addLogger(message: string) {
    if (this.logger.length >= MAX_LOG_LENGTH) {
      this.logger.shift();
    }
    this.logger.push(message);
    return Promise.resolve(true);
  }

  @backgroundMethod()
  async checkLockStatus(offset = 0) {
    const { appSelector, engine } = this.backgroundApi;

    const enableAppLock = appSelector((s) => s.settings.enableAppLock);
    const appLockDuration = appSelector((s) => s.settings.appLockDuration);

    const lastActivity = await simpleDb.lastActivity.getValue();
    const isPasswordSet = await engine.isMasterPasswordSet();
    const prerequisites = isPasswordSet && enableAppLock;
    if (!prerequisites) return;

    const idleDuration = Math.floor((Date.now() - lastActivity) / (1000 * 60));
    const isStale = idleDuration >= Math.min(240, appLockDuration + offset);
    if (isStale) {
      this.lock();
    }
  }

  @backgroundMethod()
  async refreshLastActivity() {
    return simpleDb.lastActivity.setValue(Date.now());
  }

  @backgroundMethod()
  isUnlock(): Promise<boolean> {
    const { appSelector } = this.backgroundApi;
    const isUnlock = appSelector((s) => s.data.isUnlock);
    const isStatusUnlock = appSelector((s) => s.status.isUnlock);
    return Promise.resolve(Boolean(isUnlock && isStatusUnlock));
  }

  @backgroundMethod()
  async isLock(): Promise<boolean> {
    const isUnlock = await this.isUnlock();
    return !isUnlock;
  }

  @backgroundMethod()
  restartApp() {
    if (platformEnv.isNativeAndroid) {
      NativeAppRestart.restart();
    }
    if (platformEnv.isNative) {
      return RNRestart.Restart();
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

  async stopAllServiceInterval() {
    const {
      serviceNotification,
      serviceOverview,
      serviceSocket,
      serviceToken,
    } = this.backgroundApi;
    if (this.interval) {
      clearInterval(this.interval);
    }
    serviceNotification.clear();
    await serviceOverview.stopQueryPendingTasks();
    serviceSocket.clear();
    await serviceToken.stopRefreshAccountTokens();
  }

  resetAppAtTime = 0;

  @backgroundMethod()
  async resetApp() {
    const {
      engine,
      dispatch,
      persistor,
      serviceNetwork,
      serviceAccount,
      serviceNotification,
      appSelector,
    } = this.backgroundApi;
    this.resetAppAtTime = Date.now();

    await this.stopAllServiceInterval();

    timerUtils.disableSetInterval();

    // Stop auto-save first
    persistor.pause();
    const pushEnable = appSelector(
      (s) => s.settings?.pushNotification?.pushEnable,
    );
    if (pushEnable) {
      await serviceNotification.syncPushNotificationConfig('reset');
    }
    await persistor.purge();
    await engine.resetApp();
    if (platformEnv.isRuntimeBrowser) {
      window.localStorage.clear();
    }
    if (platformEnv.isDesktop) {
      window.desktopApi?.clearAutoUpdateSettings?.();
    }
    await appStorage.clear();
    dispatch({ type: 'LOGOUT', payload: undefined });
    serviceNetwork.notifyChainChanged();
    serviceAccount.notifyAccountsChanged();

    try {
      if (platformEnv.isNativeAndroid && (await isAvailable())) {
        logoutFromGoogleDrive(true);
        await wait(1000);
      }
    } catch (error) {
      // ignore
    }

    // await engine.resetApp() is NOT reliable of DB clean, so we need delay here.
    await wait(1500);

    // restartApp() MUST be called from background in Ext
    this.restartApp();

    await wait(1500);
    this.resetAppAtTime = 0;
    timerUtils.enableSetInterval();
  }

  @backgroundMethod()
  async isResettingApp(): Promise<boolean> {
    return Promise.resolve(Date.now() - this.resetAppAtTime < 5000);
  }

  @backgroundMethod()
  openExtensionExpandTab(routeInfo: OpenUrlRouteInfo) {
    // add whitelist to
    //    packages/kit/src/routes/linking.ts
    extUtils.openExpandTab(routeInfo);
  }

  autoOpenOnboardingIfExtensionInstalled() {
    if (!platformEnv.isExtension) {
      return;
    }
    chrome.runtime.onInstalled.addListener((details) => {
      if (details.reason === 'install') {
        debugLogger.common.info('Extension event: first installed');
        // setTimeout to avoid RESET trigger install
        setTimeout(() => {
          extUtils.openExpandTab({
            routes: [RootRoutes.Main],
            params: {},
          });
        }, 1000);
      } else if (details.reason === 'update') {
        const thisVersion = chrome.runtime.getManifest()?.version;
        debugLogger.common.info(
          `Extension event: Updated from ${
            details?.previousVersion || ''
          } to ${thisVersion}!`,
        );
      }
    });
  }

  initAppAfterStoreReady() {
    const { bootstrapped } = this.backgroundApi.persistor.getState();
    if (bootstrapped) {
      this.initApp();
    } else {
      appEventBus.once(AppEventBusNames.StoreInitedFromPersistor, () => {
        this.initApp();
      });
    }
  }

  /**
   * Initialize APP job, will show splash screen at first time.
   */
  @backgroundMethod()
  async initApp() {
    const {
      engine,
      appSelector,
      serviceBootstrap,
      serviceSetting,
      serviceSwap,
      serviceDiscover,
      serviceCloudBackup,
    } = this.backgroundApi;

    const enableTestFiatEndpoint =
      appSelector(
        (s) => s?.settings?.devMode?.enableTestFiatEndpoint ?? false,
      ) ?? false;

    switchTestEndpoint(enableTestFiatEndpoint);

    if (platformEnv.isExtensionBackground) {
      serviceSetting.checkBrowserActionIcon();
    }

    await engine.cleanupDBOnStart();

    await this.initPassword();
    await this.initLocalAuthentication();
    await this.checkLockStatus();
    serviceDiscover.init();

    await serviceBootstrap.preBootstrap();

    const activeIds = await this.initActiveIds();

    serviceSwap.initSwap();
    serviceCloudBackup.loginIfNeeded(false);

    if (activeIds.activeNetworkId) {
      engine.updateOnlineTokens(activeIds.activeNetworkId, false);
    }

    serviceBootstrap.bootstrap();
    this._appInited = true;
  }

  @backgroundMethod()
  async initActiveIds() {
    const { engine, dispatch, serviceAccount, serviceNetwork } =
      this.backgroundApi;
    const networks = await serviceNetwork.initNetworks();
    const wallets = await serviceAccount.initWallets();
    const activeNetworkId = serviceNetwork.initCheckingNetwork(networks);
    const activeWalletId = serviceAccount.initCheckingWallet(wallets);
    const accounts = await serviceAccount.reloadAccountsByWalletIdNetworkId(
      activeWalletId,
      activeNetworkId,
    );
    const activeAccountId = serviceAccount.initCheckingAccount(accounts);

    if (activeNetworkId) {
      engine.updateOnlineTokens(activeNetworkId, false);
    }

    const activeIds = {
      activeAccountId,
      activeWalletId,
      activeNetworkId,
    };

    dispatch(setActiveIds(activeIds));
    return activeIds;
  }

  @backgroundMethod()
  async initLocalAuthentication() {
    const { engine, dispatch, appSelector } = this.backgroundApi;
    const setting: { enableLocalAuthentication: boolean } = appSelector(
      (s) => s.settings,
    );
    if (setting.enableLocalAuthentication) {
      const isSupported = await hasHardwareSupported();
      if (isSupported) {
        const password = await getPassword();
        if (password) {
          const success = await engine.verifyMasterPassword(password);
          if (!success) {
            dispatch(setEnableLocalAuthentication(false));
          }
        } else {
          dispatch(setEnableLocalAuthentication(false));
        }
      }
    }
  }

  @backgroundMethod()
  async initPassword() {
    const { engine, dispatch } = this.backgroundApi;
    const isMasterPasswordSet = await engine.isMasterPasswordSet();
    if (isMasterPasswordSet) {
      dispatch(passwordSet(), setBoardingCompleted());
    }
  }

  @backgroundMethod()
  async updatePassword(oldPassword: string, newPassword: string) {
    const {
      dispatch,
      engine,
      appSelector,
      servicePassword,
      serviceCloudBackup,
    } = this.backgroundApi;
    await engine.updatePassword(oldPassword, newPassword);
    const data: { isPasswordSet: boolean } = appSelector((s) => s.data);
    const status: { boardingCompleted: boolean } = appSelector((s) => s.status);

    const actions = [];
    if (!data.isPasswordSet) {
      actions.push(passwordSet());
      actions.push(setEnableAppLock(true));
    }
    if (!status.boardingCompleted) {
      actions.push(setBoardingCompleted());
    }
    dispatch(...actions, unlock(), release());
    await servicePassword.savePassword(newPassword);
    serviceCloudBackup.requestBackup();
  }

  @backgroundMethod()
  async verifyPassword(password: string) {
    const { engine } = this.backgroundApi;
    const result = await engine.verifyMasterPassword(password);
    return result;
  }

  @backgroundMethod()
  lock(handOperated = false) {
    const { dispatch, servicePassword } = this.backgroundApi;
    servicePassword.clearData();
    dispatch(setHandOperatedLock(handOperated), lock());
  }

  @backgroundMethod()
  async unlock(password: string): Promise<boolean> {
    const { dispatch, servicePassword } = this.backgroundApi;
    const isOk = await servicePassword.verifyPassword(password);
    if (isOk) {
      await servicePassword.savePassword(password);
      dispatch(setHandOperatedLock(false), unlock(), release());
      appEventBus.emit(AppEventBusNames.Unlocked);
    }
    return isOk;
  }

  @backgroundMethod()
  webPureUnlock() {
    const { dispatch } = this.backgroundApi;
    dispatch(setHandOperatedLock(false), unlock(), release());
    appEventBus.emit(AppEventBusNames.Unlocked);
  }

  @backgroundMethod()
  checkUpdateStatus() {
    const { store } = this.backgroundApi;
    const { lastCheckTimestamp } = store.getState().autoUpdate;

    let checkTimeDelay = getTimeDurationMs({ hour: 1 });
    if (platformEnv.isExtension) {
      checkTimeDelay = getTimeDurationMs({ hour: 3 });
    }

    if (getTimeStamp() - (lastCheckTimestamp ?? 0) > checkTimeDelay) {
      return appUpdates.checkUpdate().then();
    }
  }
}

export default ServiceApp;
