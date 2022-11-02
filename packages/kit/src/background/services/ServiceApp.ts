import RNRestart from 'react-native-restart';

import simpleDb from '@onekeyhq/engine/src/dbs/simple/simpleDb';
import { switchTestEndpoint } from '@onekeyhq/engine/src/endpoint';
import { setActiveIds } from '@onekeyhq/kit/src/store/reducers/general';
import {
  AppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
import debugLogger from '@onekeyhq/shared/src/logger/debugLogger';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import appStorage from '@onekeyhq/shared/src/storage/appStorage';

import { RootRoutes } from '../../routes/routesEnum';
import {
  passwordSet,
  release,
  setHandOperatedLock,
} from '../../store/reducers/data';
import {
  setEnableAppLock,
  setEnableLocalAuthentication,
} from '../../store/reducers/settings';
import {
  lock,
  setBoardingCompleted,
  unlock,
} from '../../store/reducers/status';
import extUtils, { OpenUrlRouteInfo } from '../../utils/extUtils';
import { getTimeDurationMs, wait } from '../../utils/helper';
import {
  getPassword,
  hasHardwareSupported,
} from '../../utils/localAuthentication';
import { EOnboardingRoutes } from '../../views/Onboarding/routes/enums';
import { backgroundClass, backgroundMethod } from '../decorators';
import { MAX_LOG_LENGTH, waitForDataLoaded } from '../utils';

import ServiceBase, { IServiceBaseProps } from './ServiceBase';

@backgroundClass()
class ServiceApp extends ServiceBase {
  private _appInited = false;

  constructor(props: IServiceBaseProps) {
    super(props);
    this.initAppAfterStoreReady();
    if (platformEnv.isExtensionBackground) {
      this.autoOpenOnboardingIfExtensionInstalled();
      setInterval(() => this.checkLockStatus(1), 60 * 1000);
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

  isUnlock(): boolean {
    const { appSelector } = this.backgroundApi;
    const isUnlock = appSelector((s) => s.data.isUnlock);
    const isStatusUnlock = appSelector((s) => s.status.isUnlock);
    return Boolean(isUnlock && isStatusUnlock);
  }

  @backgroundMethod()
  restartApp() {
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

    // await engine.resetApp() is NOT reliable of DB clean, so we need delay here.
    await wait(1500);
    // restartApp() MUST be called from background in Ext
    this.restartApp();

    await wait(1500);
    this.resetAppAtTime = 0;
  }

  @backgroundMethod()
  async isResettingApp(): Promise<boolean> {
    return Promise.resolve(Date.now() - this.resetAppAtTime < 5000);
  }

  @backgroundMethod()
  openExtensionExpandTab(routeInfo: OpenUrlRouteInfo) {
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
            routes: [RootRoutes.Onboarding, EOnboardingRoutes.Welcome],
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
      dispatch,
      engine,
      serviceAccount,
      serviceNetwork,
      appSelector,
      serviceBootstrap,
      serviceOnboarding,
    } = this.backgroundApi;

    const enableTestFiatEndpoint =
      appSelector(
        (s) => s?.settings?.devMode?.enableTestFiatEndpoint ?? false,
      ) ?? false;

    switchTestEndpoint(enableTestFiatEndpoint);

    await engine.cleanupDBOnStart();

    await this.initPassword();
    await this.initLocalAuthentication();
    await this.checkLockStatus();

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
      await engine.updateOnlineTokens(activeNetworkId, false);
    }

    dispatch(
      setActiveIds({
        activeAccountId,
        activeWalletId,
        activeNetworkId,
      }),
    );

    serviceBootstrap.switchDefaultRpcToOnekeyRpcNode();
    serviceOnboarding.checkOnboardingStatus();
    this._appInited = true;
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
    }
    return isOk;
  }
}

export default ServiceApp;
