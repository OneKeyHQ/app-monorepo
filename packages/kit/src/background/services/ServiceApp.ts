import RNRestart from 'react-native-restart';

import { Account } from '@onekeyhq/engine/src/types/account';
import { Network } from '@onekeyhq/engine/src/types/network';
import { Wallet } from '@onekeyhq/engine/src/types/wallet';
import { setActiveIds } from '@onekeyhq/kit/src/store/reducers/general';
import {
  updateNetworks,
  updateWallets,
} from '@onekeyhq/kit/src/store/reducers/runtime';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { unlock as mUnlock, passwordSet } from '../../store/reducers/data';
import {
  setEnableAppLock,
  setEnableLocalAuthentication,
} from '../../store/reducers/settings';
import { setBoardingCompleted, unlock } from '../../store/reducers/status';
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
    if (platformEnv.isBrowser) {
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
    const { dispatch, serviceAccount } = this.backgroundApi;
    await this.initPassword();
    await this.initLocalAuthentication();

    const networks = await this.initNetworks();
    const wallets = await this.initWallets();
    const activeNetworkId = this.initCheckingNetwork(networks);
    const activeWalletId = this.initCheckingWallet(wallets);

    const accounts = await serviceAccount.reloadAccountsByWalletIdNetworkId(
      activeWalletId,
      activeNetworkId,
    );

    const activeAccountId = this.initCheckingAccount(accounts);
    dispatch(
      setActiveIds({
        activeAccountId,
        activeWalletId,
        activeNetworkId,
      }),
    );
  }

  @backgroundMethod()
  async initNetworks() {
    const { engine, dispatch } = this.backgroundApi;
    await engine.syncPresetNetworks();
    const networksFromBE = await engine.listNetworks(false);
    dispatch(updateNetworks(networksFromBE));
    return networksFromBE;
  }

  @backgroundMethod()
  async initWallets() {
    const { engine, dispatch } = this.backgroundApi;
    const wallets = await engine.getWallets();
    dispatch(updateWallets(wallets));
    return wallets;
  }

  @backgroundMethod()
  initCheckingNetwork(networks: Network[]): string | null {
    const { appSelector } = this.backgroundApi;
    // first time read from local storage
    const previousActiveNetworkId: string = appSelector(
      (s) => s.general.activeNetworkId,
    );
    const isValidNetworkId = networks.some(
      (network) => network.id === previousActiveNetworkId,
    );
    if (!previousActiveNetworkId || !isValidNetworkId) {
      return networks[0]?.id ?? null;
    }
    return previousActiveNetworkId;
  }

  @backgroundMethod()
  initCheckingWallet(wallets: Wallet[]): string | null {
    const { appSelector } = this.backgroundApi;
    // first time read from local storage
    const previousWalletId: string = appSelector(
      (s) => s.general.activeWalletId,
    );
    const isValidNetworkId = wallets.some(
      (wallet) => wallet.id === previousWalletId,
    );
    if (!previousWalletId || !isValidNetworkId) {
      return wallets[0]?.id ?? null;
    }
    return previousWalletId;
  }

  @backgroundMethod()
  initCheckingAccount(accounts?: Account[]): string | null {
    if (!accounts) return null;

    const { appSelector } = this.backgroundApi;
    // first time read from local storage
    const previousAccountId: string = appSelector(
      (s) => s.general.activeAccountId,
    );
    const isValidAccountId = accounts.some(
      (account) => account.id === previousAccountId,
    );
    if (!previousAccountId || !isValidAccountId) {
      return accounts[0]?.id ?? null;
    }
    return previousAccountId;
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
    }
  }

  @backgroundMethod()
  async autoChangeWallet() {
    // const { dispatch, engine, serviceAccount, appSelector } =
    //   this.backgroundApi;
    // const walletsFromBE = await engine.getWallets();
    // dispatch(updateWallets(walletsFromBE));
    // const { network }: { network: Network } = appSelector(
    //   (s) => s.runtime.activeNetwork,
    // );
    // let wallet: Wallet | null =
    //   walletsFromBE.find(($wallet) => $wallet.accounts.length > 0) ?? null;
    // let account: Account | null = null;
    // if (wallet) {
    //   account = await engine.getAccount(wallet.accounts[0], network.id);
    // } else if (walletsFromBE.length > 0) {
    //   const $wallet = walletsFromBE[0];
    //   wallet = $wallet;
    // }
    // serviceAccount.changeActiveAccount({
    //   account,
    //   wallet,
    // });
  }

  @backgroundMethod()
  async createHDWallet({
    password,
    mnemonic,
  }: {
    password: string;
    mnemonic?: string;
  }) {
    const { dispatch, engine, serviceAccount, appSelector } =
      this.backgroundApi;
    const wallet = await engine.createHDWallet(password, mnemonic);
    const data: { isPasswordSet: boolean } = appSelector((s) => s.data);
    const status: { boardingCompleted: boolean } = appSelector((s) => s.status);
    if (!status.boardingCompleted) {
      dispatch(setBoardingCompleted());
    }
    if (!data.isPasswordSet) {
      dispatch(passwordSet());
      dispatch(setEnableAppLock(true));
    }
    dispatch(unlock());
    dispatch(mUnlock());
    // const walletsFromBE = await engine.getWallets();
    // dispatch(updateWallets(walletsFromBE));
    // let account: Account | null = null;
    // if (wallet.accounts.length > 0) {
    //   const { network }: { network: Network } = appSelector(
    //     (s) => s.general.activeNetwork,
    //   );
    //   account = await engine.getAccount(wallet.accounts[0], network.id);
    // }
    // serviceAccount.changeActiveAccount({
    //   account,
    //   wallet,
    // });
    return wallet;
  }

  @backgroundMethod()
  async addImportedAccount(
    password: string,
    networkId: string,
    credential: string,
    name?: string,
  ) {
    const { dispatch, engine, serviceAccount, appSelector, serviceNetwork } =
      this.backgroundApi;
    const account = await engine.addImportedAccount(
      password,
      networkId,
      credential,
      name,
    );
    const status: { boardingCompleted: boolean } = appSelector((s) => s.status);
    if (!status.boardingCompleted) {
      dispatch(setBoardingCompleted());
    }
    const data: { isPasswordSet: boolean } = appSelector((s) => s.data);
    if (!data.isPasswordSet) {
      dispatch(passwordSet());
      dispatch(setEnableAppLock(true));
    }
    dispatch(unlock());
    dispatch(mUnlock());

    const wallets = await serviceAccount.initWallets();
    const watchedWallet = wallets.find((wallet) => wallet.type === 'imported');
    if (!watchedWallet) return;
    await serviceAccount.reloadAccountsByWalletIdNetworkId(
      watchedWallet?.id,
      networkId,
    );

    dispatch(
      setActiveIds({
        activeAccountId: account.id,
        activeWalletId: watchedWallet.id,
        activeNetworkId: networkId,
      }),
    );
    return account;
  }

  @backgroundMethod()
  async addWatchAccount(networkId: string, address: string, name: string) {
    const { dispatch, engine, serviceAccount, appSelector } =
      this.backgroundApi;
    const account = await engine.addWatchingAccount(networkId, address, name);

    const status: { boardingCompleted: boolean } = appSelector((s) => s.status);
    if (!status.boardingCompleted) {
      dispatch(setBoardingCompleted());
    }
    dispatch(unlock());
    dispatch(mUnlock());

    const wallets = await serviceAccount.initWallets();
    const watchedWallet = wallets.find((wallet) => wallet.type === 'watching');
    if (!watchedWallet) return;
    await serviceAccount.reloadAccountsByWalletIdNetworkId(
      watchedWallet?.id,
      networkId,
    );

    dispatch(
      setActiveIds({
        activeAccountId: account.id,
        activeWalletId: watchedWallet.id,
        activeNetworkId: networkId,
      }),
    );
  }

  @backgroundMethod()
  async updatePassword(oldPassword: string, newPassword: string) {
    const { dispatch, engine, appSelector } = this.backgroundApi;
    await engine.updatePassword(oldPassword, newPassword);
    const data: { isPasswordSet: boolean } = appSelector((s) => s.data);
    if (!data.isPasswordSet) {
      dispatch(passwordSet());
      dispatch(setEnableAppLock(true));
    }
    const status: { boardingCompleted: boolean } = appSelector((s) => s.status);
    if (!status.boardingCompleted) {
      dispatch(setBoardingCompleted());
    }
    dispatch(unlock());
    dispatch(mUnlock());
  }

  @backgroundMethod()
  async verifyPassword(password: string) {
    const { engine } = this.backgroundApi;
    const result = await engine.verifyMasterPassword(password);
    return result;
  }
}

export default ServiceApp;
