import RNRestart from 'react-native-restart';

import { setActiveIds } from '@onekeyhq/kit/src/store/reducers/general';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { passwordSet, release } from '../../store/reducers/data';
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
import { delay } from '../utils';

import ServiceBase, { IServiceBaseProps } from './ServiceBase';

@backgroundClass()
class ServiceApp extends ServiceBase {
  constructor(props: IServiceBaseProps) {
    super(props);
    // TODO recheck last reset status and resetApp here
    console.log('TODO: recheck last reset status and resetApp here');
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
    await this.initLock();

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
  async initLock() {
    const { dispatch, appSelector, engine } = this.backgroundApi;
    const {
      enableAppLock,
      appLockDuration,
    }: { enableAppLock: boolean; appLockDuration: number } = appSelector(
      (s) => s.settings,
    );
    const { lastActivity }: { lastActivity: number } = appSelector(
      (s) => s.status,
    );
    const isPasswordSet = await engine.isMasterPasswordSet();
    const prerequisites = isPasswordSet && enableAppLock;
    if (!prerequisites) return;
    const idleDuration = Math.floor((Date.now() - lastActivity) / (1000 * 60));
    const isStale = idleDuration >= appLockDuration;
    if (isStale) {
      dispatch(lock());
    }
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
}

export default ServiceApp;
