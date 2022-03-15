import { Account } from '@onekeyhq/engine/src/types/account';
import { Network } from '@onekeyhq/engine/src/types/network';
import { Wallet } from '@onekeyhq/engine/src/types/wallet';

import { runtimeUnlock } from '../../store/reducers/general';
import { updateNetworkMap } from '../../store/reducers/network';
import {
  setBoardingCompleted,
  setPasswordCompleted,
  unlock,
} from '../../store/reducers/status';
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
    let networksFromBE = await engine.listNetworks(false);
    if (!networksFromBE.length) {
      // listNetworks() will return empty after resetApp()
      //    so we should call syncPresetNetworks() here
      await engine.syncPresetNetworks();
      networksFromBE = await engine.listNetworks();
    }
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
    const { dispatch, engine, serviceAccount } = this.backgroundApi;
    const wallet = await engine.createHDWallet(password, mnemonic);
    const walletsFromBE = await engine.getWallets();
    dispatch(updateWallets(walletsFromBE));
    dispatch(setBoardingCompleted());
    dispatch(setPasswordCompleted());
    dispatch(unlock());
    dispatch(runtimeUnlock());
    serviceAccount.changeActiveAccount({
      account: null,
      wallet,
    });
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
}

export default ServiceApp;
