import * as SecureStore from 'expo-secure-store';

import { Account } from '@onekeyhq/engine/src/types/account';
import { Network } from '@onekeyhq/engine/src/types/network';
import { Wallet } from '@onekeyhq/engine/src/types/wallet';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { unlock as mUnlock, passwordSet } from '../../store/reducers/data';
import { updateNetworkMap } from '../../store/reducers/network';
import { setEnableAppLock } from '../../store/reducers/settings';
import { setBoardingCompleted, unlock } from '../../store/reducers/status';
import { updateWallet, updateWallets } from '../../store/reducers/wallet';
import { backgroundClass, backgroundMethod } from '../decorators';
import { delay } from '../utils';

import ServiceBase from './ServiceBase';

@backgroundClass()
class ServiceApp extends ServiceBase {
  @backgroundMethod()
  async resetApp() {
    const { engine, dispatch, persistor, serviceNetwork, serviceAccount } =
      this.backgroundApi;
    // Stop auto-save first
    persistor.pause();
    await persistor.purge();
    await engine.resetApp();
    dispatch({ type: 'LOGOUT', payload: undefined });
    await delay(300);
    await this.initNetworks();
    await delay(300);
    serviceNetwork.notifyChainChanged();
    serviceAccount.notifyAccountsChanged();
  }

  @backgroundMethod()
  async initNetworks() {
    const { engine, dispatch } = this.backgroundApi;
    await engine.syncPresetNetworks();
    const networksFromBE = await engine.listNetworks(false);
    dispatch(updateNetworkMap(networksFromBE));
    return networksFromBE;
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
    if (!data.isPasswordSet) {
      dispatch(passwordSet());
      dispatch(setEnableAppLock(true));
      if (platformEnv.isNative) {
        await SecureStore.setItemAsync('password', password);
      }
    }
    const walletsFromBE = await engine.getWallets();
    dispatch(updateWallets(walletsFromBE));
    dispatch(setBoardingCompleted());
    dispatch(unlock());
    dispatch(mUnlock());
    let account: Account | null = null;
    if (wallet.accounts.length > 0) {
      const { network }: { network: Network } = appSelector(
        (s) => s.general.activeNetwork,
      );
      account = await engine.getAccount(wallet.accounts[0], network.id);
    }
    serviceAccount.changeActiveAccount({
      account,
      wallet,
    });
    return wallet;
  }

  @backgroundMethod()
  async autoChangeWallet() {
    const { dispatch, engine, serviceAccount, appSelector } =
      this.backgroundApi;
    const walletsFromBE = await engine.getWallets();
    dispatch(updateWallets(walletsFromBE));

    const { network }: { network: Network } = appSelector(
      (s) => s.general.activeNetwork,
    );
    let wallet: Wallet | null =
      walletsFromBE.find(($wallet) => $wallet.accounts.length > 0) ?? null;

    let account: Account | null = null;
    if (wallet) {
      account = await engine.getAccount(wallet.accounts[0], network.id);
    } else if (walletsFromBE.length > 0) {
      const $wallet = walletsFromBE[0];
      wallet = $wallet;
    }

    serviceAccount.changeActiveAccount({
      account,
      wallet,
    });
  }

  @backgroundMethod()
  async autoChangeAccount({ walletId }: { walletId: string }) {
    const { dispatch, engine, serviceAccount, appSelector } =
      this.backgroundApi;
    const wallet: Wallet | null = await engine.getWallet(walletId);
    dispatch(updateWallet(wallet));

    const { network }: { network: Network } = appSelector(
      (s) => s.general.activeNetwork,
    );

    let account: Account | null = null;
    if (wallet && network && wallet.accounts.length > 0) {
      account = await engine.getAccount(wallet.accounts[0], network.id);
    }

    serviceAccount.changeActiveAccount({
      account,
      wallet,
    });
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
    const data: { isPasswordSet: boolean } = appSelector((s) => s.data);
    if (!data.isPasswordSet) {
      dispatch(passwordSet());
      dispatch(setEnableAppLock(true));
      if (platformEnv.isNative) {
        await SecureStore.setItemAsync('password', password);
      }
    }
    dispatch(setBoardingCompleted());
    dispatch(unlock());
    dispatch(mUnlock());
    const walletsFromBE = await engine.getWallets();
    const walletList = walletsFromBE.filter(
      (wallet) => wallet.type === 'imported',
    );
    const wallet = walletList[0];
    serviceAccount.changeActiveAccount({
      account,
      wallet,
    });
    const { network }: { network: Network } = appSelector(
      (s) => s.general.activeNetwork,
    );

    if (network.id !== networkId) {
      const networks: Network[] = appSelector((s) => s.network.network) || [];
      const selected: Network = networks.filter((i) => i.id === networkId)[0];
      if (selected) {
        serviceNetwork.changeActiveNetwork({
          network: selected,
          sharedChainName: selected.impl,
        });
      }
    }

    return account;
  }

  @backgroundMethod()
  async addWatchAccount(networkId: string, address: string, name: string) {
    const { dispatch, engine, serviceAccount, appSelector, serviceNetwork } =
      this.backgroundApi;
    const account = await engine.addWatchingAccount(networkId, address, name);
    const walletsFromBE = await engine.getWallets();
    const walletList = walletsFromBE.filter(
      (wallet) => wallet.type === 'watching',
    );
    dispatch(setBoardingCompleted());
    dispatch(unlock());
    dispatch(mUnlock());
    const wallet = walletList[0];
    serviceAccount.changeActiveAccount({
      account,
      wallet,
    });
    const { network }: { network: Network } = appSelector(
      (s) => s.general.activeNetwork,
    );
    if (network.id !== networkId) {
      const networks: Network[] = appSelector((s) => s.network.network) || [];
      const selected: Network = networks.filter((i) => i.id === networkId)[0];
      if (selected) {
        serviceNetwork.changeActiveNetwork({
          network: selected,
          sharedChainName: selected.impl,
        });
      }
    }
  }

  @backgroundMethod()
  async updatePassword(oldPassword: string, newPassword: string) {
    const { dispatch, engine, appSelector } = this.backgroundApi;
    await engine.updatePassword(oldPassword, newPassword);
    if (platformEnv.isNative) {
      await SecureStore.setItemAsync('password', newPassword);
    }
    const data: { isPasswordSet: boolean } = appSelector((s) => s.data);
    if (!data.isPasswordSet) {
      dispatch(passwordSet());
      dispatch(setEnableAppLock(true));
    }
    dispatch(setBoardingCompleted());
    dispatch(unlock());
    dispatch(mUnlock());
  }

  @backgroundMethod()
  async verifyPassword(password: string) {
    const { engine } = this.backgroundApi;
    const result = await engine.verifyMasterPassword(password);
    if (platformEnv.isNative && result) {
      await SecureStore.setItemAsync('password', password);
    }
    return result;
  }
}

export default ServiceApp;
