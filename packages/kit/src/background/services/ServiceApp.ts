import RNRestart from 'react-native-restart';

import simpleDb from '@onekeyhq/engine/src/dbs/simple/simpleDb';
import { setActiveIds } from '@onekeyhq/kit/src/store/reducers/general';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import appStorage from '@onekeyhq/shared/src/storage/appStorage';

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
import {
  getPassword,
  hasHardwareSupported,
} from '../../utils/localAuthentication';
import { backgroundClass, backgroundMethod } from '../decorators';
import { MAX_LOG_LENGTH, delay } from '../utils';

import ServiceBase, { IServiceBaseProps } from './ServiceBase';

@backgroundClass()
class ServiceApp extends ServiceBase {
  constructor(props: IServiceBaseProps) {
    super(props);
    if (platformEnv.isExtensionBackground) {
      setInterval(() => this.checkLockStatus(1), 60 * 1000);
    }
    // TODO recheck last reset status and resetApp here
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
    const appLockDuration = appSelector(
      (s) => s.settings.appLockDuration,
    ) as number;

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

  @backgroundMethod()
  async resetApp() {
    const { engine, dispatch, persistor, serviceNetwork, serviceAccount } =
      this.backgroundApi;
    // Stop auto-save first
    persistor.pause();
    await persistor.purge();
    await engine.resetApp();
    if (platformEnv.isRuntimeBrowser) {
      localStorage.clear();
    }
    await appStorage.clear();
    dispatch({ type: 'LOGOUT', payload: undefined });
    serviceNetwork.notifyChainChanged();
    serviceAccount.notifyAccountsChanged();

    // await engine.resetApp() is NOT reliable of DB clean, so we need delay here.
    await delay(1500);
    // restartApp() MUST be called from background in Ext
    this.restartApp();
  }

  /**
   * Initialize APP job, will show splash screen at first time.
   */
  @backgroundMethod()
  async initApp() {
    const { dispatch, serviceAccount, serviceNetwork } = this.backgroundApi;
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

    dispatch(
      setActiveIds({
        activeAccountId,
        activeWalletId,
        activeNetworkId,
      }),
    );
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
      dispatch(passwordSet());
      dispatch(setBoardingCompleted());
    }
  }

  @backgroundMethod()
  async updatePassword(oldPassword: string, newPassword: string) {
    const { dispatch, engine, appSelector } = this.backgroundApi;
    await engine.updatePassword(oldPassword, newPassword);
    const data: { isPasswordSet: boolean } = appSelector((s) => s.data);
    // TODO: Batch update in one action
    if (!data.isPasswordSet) {
      dispatch(passwordSet());
      dispatch(setEnableAppLock(true));
    }
    const status: { boardingCompleted: boolean } = appSelector((s) => s.status);
    if (!status.boardingCompleted) {
      dispatch(setBoardingCompleted());
    }
    dispatch(unlock());
    dispatch(release());
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
    dispatch(setHandOperatedLock(handOperated));
    dispatch(lock());
  }

  @backgroundMethod()
  async unlock(password: string): Promise<boolean> {
    const { dispatch, servicePassword } = this.backgroundApi;
    const isOk = await servicePassword.verifyPassword(password);
    if (isOk) {
      await servicePassword.savePassword(password);
      dispatch(setHandOperatedLock(false));
      dispatch(unlock());
      dispatch(release());
    }
    return isOk;
  }
}

export default ServiceApp;
