import { Account } from '@onekeyhq/engine/src/types/account';
import { Wallet } from '@onekeyhq/engine/src/types/wallet';
import { setActiveIds } from '@onekeyhq/kit/src/store/reducers/general';
import {
  updateAccountDetail,
  updateAccounts,
  updateWallet,
  updateWallets,
} from '@onekeyhq/kit/src/store/reducers/runtime';
import {
  setEnableAppLock,
  setRefreshTS,
} from '@onekeyhq/kit/src/store/reducers/settings';
import { randomAvatar } from '@onekeyhq/kit/src/utils/emojiUtils';
import { IOneKeyDeviceFeatures } from '@onekeyhq/shared/types';

import { passwordSet, release } from '../../store/reducers/data';
import { changeActiveAccount } from '../../store/reducers/general';
import { setBoardingCompleted, unlock } from '../../store/reducers/status';
import { Avatar } from '../../utils/emojiUtils';
import { backgroundClass, backgroundMethod } from '../decorators';
import ProviderApiBase from '../providers/ProviderApiBase';

import ServiceBase from './ServiceBase';

@backgroundClass()
class ServiceAccount extends ServiceBase {
  @backgroundMethod()
  async changeActiveAccount({
    accountId,
    walletId,
  }: {
    accountId: string | null;
    walletId: string | null;
  }) {
    const { dispatch, appSelector } = this.backgroundApi;
    const { activeNetworkId, activeWalletId } = appSelector((s) => s.general);
    // await this.initWallets();
    if (activeWalletId !== walletId) {
      await this.reloadAccountsByWalletIdNetworkId(walletId, activeNetworkId);
    }
    dispatch(
      changeActiveAccount({
        activeAccountId: accountId,
        activeWalletId: walletId,
      }),
    );
    this.notifyAccountsChanged();
  }

  @backgroundMethod()
  async initWallets() {
    const { engine, dispatch } = this.backgroundApi;
    const wallets = await engine.getWallets();
    dispatch(updateWallets(wallets));
    return wallets;
  }

  @backgroundMethod()
  async setAccountName(accountId: string, name: string) {
    const { engine, dispatch } = this.backgroundApi;
    const newAccount = await engine.setAccountName(accountId, name);

    dispatch(updateAccountDetail({ name, id: accountId }));

    return newAccount;
  }

  @backgroundMethod()
  async reloadAccountsByWalletIdNetworkId(
    walletId: string | null,
    networkId: string | null,
  ) {
    if (!walletId || !networkId) return;
    const { engine, dispatch } = this.backgroundApi;
    const wallet = await engine.getWallet(walletId);
    const accountIds = wallet.accounts;
    const accounts = await engine.getAccounts(accountIds, networkId);
    dispatch(updateAccounts(accounts));
    return accounts;
  }

  @backgroundMethod()
  async autoChangeAccount({ walletId }: { walletId: string }) {
    const { dispatch, engine, serviceAccount, appSelector } =
      this.backgroundApi;
    const wallet: Wallet | null = await engine.getWallet(walletId);
    dispatch(updateWallet(wallet));

    const activeNetworkId = appSelector((s) => s.general.activeNetworkId);

    let accountId: string | null = null;
    if (wallet && activeNetworkId && wallet.accounts.length > 0) {
      const account = await engine.getAccounts(
        wallet.accounts,
        activeNetworkId,
      );
      accountId = account?.[0]?.id ?? null;
    }
    serviceAccount.changeActiveAccount({
      accountId,
      walletId,
    });
  }

  @backgroundMethod()
  notifyAccountsChanged(): void {
    Object.values(this.backgroundApi.providers).forEach(
      (provider: ProviderApiBase) => {
        provider.notifyDappAccountsChanged({
          send: this.backgroundApi.sendForProvider(provider.providerName),
        });
      },
    );
    this.backgroundApi.walletConnect.notifySessionChanged();
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
      const defaultWallet =
        wallets.find(($wallet) => $wallet.accounts.length > 0) ?? null;
      // HD or HW wallet with no accounts
      const noAccountsHDHWWallets =
        wallets.find((wallet) => ['hw', 'hd'].includes(wallet.type)) ?? null;
      return defaultWallet?.id ?? noAccountsHDHWWallets?.id ?? null;
    }
    return previousWalletId;
  }

  @backgroundMethod()
  async autoChangeWallet() {
    const { engine, serviceAccount, appSelector } = this.backgroundApi;
    const wallets = await this.initWallets();

    const activeNetworkId = appSelector((s) => s.general.activeNetworkId);
    let wallet: Wallet | null =
      wallets.find(($wallet) => $wallet.accounts.length > 0) ?? null;
    let account: Account | null = null;
    if (wallet) {
      account = await engine.getAccount(wallet.accounts?.[0], activeNetworkId);
    } else {
      wallet =
        wallets.find(($wallet) => ['hw', 'hd'].includes($wallet.type)) ?? null;

      if (!wallet) {
        // Check for imported wallets
        wallet =
          wallets
            .filter(($wallet) => $wallet.accounts.length > 0)
            .find(($wallet) =>
              ['imported', 'watching'].includes($wallet.type),
            ) ?? null;
      }
    }

    serviceAccount.changeActiveAccount({
      accountId: account?.id ?? null,
      walletId: wallet?.id ?? null,
    });
  }

  @backgroundMethod()
  async createHDWallet({
    password,
    mnemonic,
    avatar,
  }: {
    password: string;
    mnemonic?: string;
    avatar?: Avatar;
  }) {
    const { dispatch, engine, appSelector, serviceAccount } =
      this.backgroundApi;
    const wallet = await engine.createHDWallet({
      password,
      mnemonic,
      avatar: avatar ?? randomAvatar(),
    });
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
    dispatch(release());

    await serviceAccount.initWallets();
    await serviceAccount.autoChangeAccount({ walletId: wallet.id });
    return wallet;
  }

  @backgroundMethod()
  async addHDAccounts(
    password: string,
    walletId: string,
    networkId: string,
    index?: number[],
    names?: string[],
    purpose?: number,
  ) {
    const { engine, dispatch } = this.backgroundApi;
    const accounts = await engine.addHdOrHwAccounts(
      password,
      walletId,
      networkId,
      index,
      names,
      purpose,
    );

    if (!accounts.length) return;

    const activeAccount = accounts[0];
    await this.initWallets();
    await this.reloadAccountsByWalletIdNetworkId(walletId, networkId);

    dispatch(
      setActiveIds({
        activeAccountId: activeAccount.id,
        activeWalletId: walletId,
        activeNetworkId: networkId,
      }),
    );
    return accounts;
  }

  @backgroundMethod()
  async addImportedAccount(
    password: string,
    networkId: string,
    credential: string,
    name?: string,
  ) {
    const { dispatch, engine, serviceAccount, appSelector } =
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
    dispatch(release());

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
    dispatch(release());

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
  async createHWWallet({
    features,
    avatar,
    connectId,
  }: {
    features: IOneKeyDeviceFeatures;
    avatar?: Avatar;
    connectId: string;
  }) {
    const { dispatch, engine, serviceAccount, appSelector } =
      this.backgroundApi;
    const networkId = appSelector((s) => s.general.activeNetworkId);
    // const wallets: Wallet[] = appSelector((s) => s.runtime.wallets);
    let account = null;

    // await engine.upsertDevice(features, connectId);
    // const deviceId = features.onekey_serial ?? features.serial_no ?? '';

    const wallet = await engine.createHWWallet({
      avatar: avatar ?? randomAvatar(),
      features,
      connectId,
    });

    try {
      const accounts = await engine.addHdOrHwAccounts(
        'Undefined',
        wallet.id,
        networkId,
      );
      if (accounts.length > 0) {
        const $account = accounts[0];
        account = $account;
      }
    } catch (error) {
      // TODO need to handle this error
    }

    const status: { boardingCompleted: boolean } = appSelector((s) => s.status);
    if (!status.boardingCompleted) {
      dispatch(setBoardingCompleted());
    }
    dispatch(unlock());
    dispatch(release());

    await this.initWallets();
    serviceAccount.changeActiveAccount({
      accountId: account?.id ?? null,
      walletId: wallet?.id ?? null,
    });
    return wallet;
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
  async removeWallet(walletId: string, password: string | undefined) {
    const { appSelector, engine, dispatch } = this.backgroundApi;
    const activeWalletId = appSelector((s) => s.general.activeWalletId);
    await engine.removeWallet(walletId, password ?? '');

    if (activeWalletId === walletId) {
      await this.autoChangeWallet();
    } else {
      await this.initWallets();
    }

    dispatch(setRefreshTS());
  }

  @backgroundMethod()
  async removeAccount(
    walletId: string,
    accountId: string,
    password: string | undefined,
  ) {
    const { appSelector, engine, dispatch } = this.backgroundApi;
    const activeAccountId = appSelector((s) => s.general.activeAccountId);
    await engine.removeAccount(accountId, password ?? '');

    if (activeAccountId === accountId) {
      await this.autoChangeAccount({ walletId });
    } else {
      const wallet: Wallet | null = await engine.getWallet(walletId);
      dispatch(updateWallet(wallet));
    }

    dispatch(setRefreshTS());
  }
}

export default ServiceAccount;
