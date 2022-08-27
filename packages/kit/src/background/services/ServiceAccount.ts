import { find, flatten } from 'lodash';

import { NETWORK_ID_EVM_ETH } from '@onekeyhq/engine/src/constants';
import simpleDb from '@onekeyhq/engine/src/dbs/simple/simpleDb';
import { isHardwareWallet } from '@onekeyhq/engine/src/engineUtils';
import { isAccountCompatibleWithNetwork } from '@onekeyhq/engine/src/managers/account';
import {
  generateNetworkIdByChainId,
  getCoinTypeFromNetworkId,
} from '@onekeyhq/engine/src/managers/network';
import { INetwork, IWallet } from '@onekeyhq/engine/src/types';
import { Account, DBAccount } from '@onekeyhq/engine/src/types/account';
import { Wallet, WalletType } from '@onekeyhq/engine/src/types/wallet';
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
import {
  AppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
import { IOneKeyDeviceFeatures } from '@onekeyhq/shared/types';

import { getActiveWalletAccount } from '../../hooks/redux';
import { getManageNetworks } from '../../hooks/useManageNetworks';
import { passwordSet, release } from '../../store/reducers/data';
import { changeActiveAccount } from '../../store/reducers/general';
import { setBoardingCompleted, unlock } from '../../store/reducers/status';
import { Avatar } from '../../utils/emojiUtils';
import { wait } from '../../utils/helper';
import { backgroundClass, backgroundMethod } from '../decorators';
import ProviderApiBase from '../providers/ProviderApiBase';

import ServiceBase, { IServiceBaseProps } from './ServiceBase';

@backgroundClass()
class ServiceAccount extends ServiceBase {
  constructor(props: IServiceBaseProps) {
    super(props);
    appEventBus.on(AppEventBusNames.AccountNameChanged, () => {
      this.addressLabelCache = {};
    });
  }

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
    const { engine, dispatch, serviceCloudBackup } = this.backgroundApi;
    const newAccount = await engine.setAccountName(accountId, name);

    dispatch(updateAccountDetail({ name, id: accountId }));
    if (!accountId.startsWith('hw')) {
      serviceCloudBackup.requestBackup();
    }

    appEventBus.emit(AppEventBusNames.AccountNameChanged);

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
  async notifyAccountsChanged(): Promise<void> {
    await wait(600);
    Object.values(this.backgroundApi.providers).forEach(
      (provider: ProviderApiBase) => {
        provider.notifyDappAccountsChanged({
          send: this.backgroundApi.sendForProvider(provider.providerName),
        });
      },
    );
    await this.backgroundApi.walletConnect.notifySessionChanged();
    // emit at next tick
    await wait(100);
    appEventBus.emit(AppEventBusNames.AccountChanged);
  }

  @backgroundMethod()
  initCheckingWallet(wallets: Wallet[]): string | null {
    const { appSelector } = this.backgroundApi;
    // first time read from local storage
    const previousWalletId = appSelector((s) => s.general.activeWalletId);
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
    const { engine, appSelector } = this.backgroundApi;
    const wallets = await this.initWallets();

    const activeNetworkId = appSelector((s) => s.general.activeNetworkId);
    if (!activeNetworkId) {
      return;
    }
    for (const wallet of wallets) {
      // First find wallet & account compatible with currect network.
      if (wallet.accounts.length > 0) {
        const [account] = await engine.getAccounts(
          wallet.accounts,
          activeNetworkId,
        );
        if (account) {
          this.changeActiveAccount({
            accountId: account.id,
            walletId: wallet.id,
          });
          return;
        }
      }
    }

    // No compatible account found, set account to null and wallet to:
    //   - first non-empty wallet
    //   - first hd or hw wallet
    //   - first imported or watching wallet
    const { id: walletId } =
      // wallet not empty?
      wallets.find(($wallet) => $wallet.accounts.length > 0) ??
        // HD or HW type?
        wallets.find(($wallet) => ['hw', 'hd'].includes($wallet.type)) ??
        // imported or watching?
        wallets.find(($wallet) =>
          ['imported', 'watching'].includes($wallet.type),
        ) ?? { id: null };

    this.changeActiveAccount({ accountId: null, walletId });
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
    const {
      dispatch,
      engine,
      appSelector,
      serviceAccount,
      serviceApp,
      servicePassword,
      serviceCloudBackup,
    } = this.backgroundApi;
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
    const isOk = await serviceApp.verifyPassword(password);
    if (isOk) {
      servicePassword.savePassword(password);
    }
    serviceCloudBackup.requestBackup();
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
    const { engine } = this.backgroundApi;
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

    let walletType: WalletType = 'hd';
    if (isHardwareWallet({ walletId })) {
      walletType = 'hw';
    }

    await this.postAccountAdded({
      networkId,
      account: activeAccount,
      walletType,
      walletId,
      checkOnBoarding: false,
      checkPasswordSet: false,
      shouldBackup: true,
      password,
    });

    return accounts;
  }

  @backgroundMethod()
  async addImportedAccount(
    password: string,
    networkId: string,
    credential: string,
    name?: string,
  ) {
    const { engine } = this.backgroundApi;
    const account = await engine.addImportedAccount(
      password,
      networkId,
      credential,
      name,
    );

    await this.postAccountAdded({
      networkId,
      account,
      walletType: 'imported',
      checkOnBoarding: true,
      checkPasswordSet: true,
      shouldBackup: true,
      password,
    });

    return account;
  }

  @backgroundMethod()
  async changeActiveAccountByAddress({
    address,
    networkId,
  }: {
    address: string;
    networkId?: string;
  }): Promise<
    { wallet: IWallet; account: DBAccount; network: INetwork } | undefined
  > {
    try {
      const { appSelector, serviceNetwork } = this.backgroundApi;
      // TODO skip change if match to current active address
      const account = await this.getDBAccountByAddress({ address, networkId });
      if (account) {
        const { wallets, networks } = appSelector((s) => s.runtime);
        // TODO walletId in active
        const wallet = wallets.find((item) =>
          item.accounts.includes(account.id),
        );
        // TODO networkId in params, networkId in active
        const network = networks.find((item) =>
          isAccountCompatibleWithNetwork(account.id, item.id),
        );
        if (wallet && account && network) {
          await serviceNetwork.changeActiveNetwork(network.id);
          await this.changeActiveAccount({
            accountId: account.id,
            walletId: wallet.id,
          });
          return { wallet, account, network };
        }
      }
    } catch (error) {
      return undefined;
    }

    return undefined;
  }

  @backgroundMethod()
  async getDBAccountByAddress({
    address,
    networkId,
  }: {
    address: string;
    networkId?: string;
  }): Promise<DBAccount> {
    const coinType = networkId ? getCoinTypeFromNetworkId(networkId) : '';
    const { engine } = this.backgroundApi;
    const dbAccount = await engine.dbApi.getAccountByAddress({
      address,
      coinType,
    });
    return dbAccount;
  }

  @backgroundMethod()
  async addTemporaryWatchAccount({ address }: { address: string }) {
    const { engine } = this.backgroundApi;
    const { watchingWallet } = getActiveWalletAccount();
    const id = watchingWallet?.nextAccountIds?.global;
    const name = id ? `Account #${id}` : '';
    const networkId = NETWORK_ID_EVM_ETH;
    // TODO remove prev temp account
    // TODO set new account is temp
    const account = await engine.addWatchingOrExternalAccount({
      networkId,
      address,
      name,
      walletType: 'watching',
      checkExists: true,
    });
    await this.postAccountAdded({
      networkId,
      account,
      walletType: 'watching',
      checkOnBoarding: false,
      checkPasswordSet: false,
      shouldBackup: false,
    });
    return account;
  }

  // networkId="evm--1"
  @backgroundMethod()
  async addWatchAccount(networkId: string, address: string, name: string) {
    const { engine } = this.backgroundApi;
    const account = await engine.addWatchingOrExternalAccount({
      networkId,
      address,
      name,
      walletType: 'watching',
    });

    await this.postAccountAdded({
      networkId,
      account,
      walletType: 'watching',
      checkOnBoarding: true,
      checkPasswordSet: false,
      shouldBackup: true,
    });
    return account;
  }

  @backgroundMethod()
  async addExternalAccount({
    impl,
    chainId,
    address,
    name,
  }: {
    impl: string;
    chainId: string | number;
    address: string;
    name: string;
  }) {
    let networkId = generateNetworkIdByChainId({
      impl,
      chainId,
    });
    const { enabledNetworks } = getManageNetworks();
    const isNetworkEnabled = Boolean(
      enabledNetworks.find((item) => item.id === networkId),
    );
    // fallback to ETH if network not enabled or exists
    if (!isNetworkEnabled) {
      networkId = NETWORK_ID_EVM_ETH;
    }

    const { engine } = this.backgroundApi;

    const account = await engine.addWatchingOrExternalAccount({
      networkId,
      address,
      name,
      walletType: 'external',
      checkExists: true,
    });

    await this.postAccountAdded({
      networkId,
      account,
      walletType: 'external',
      checkOnBoarding: true,
      checkPasswordSet: false,
      shouldBackup: false,
    });

    return account;
  }

  async postAccountAdded({
    networkId,
    account,
    walletType,
    walletId,
    checkOnBoarding,
    checkPasswordSet,
    shouldBackup,
    password,
  }: {
    networkId: string;
    account: Account;
    walletType: WalletType;
    walletId?: string;
    checkOnBoarding: boolean;
    checkPasswordSet: boolean;
    password?: string;
    shouldBackup: boolean;
  }) {
    const {
      dispatch,
      serviceApp,
      servicePassword,
      serviceAccount,
      appSelector,
      serviceCloudBackup,
    } = this.backgroundApi;

    if (checkOnBoarding) {
      const status: { boardingCompleted: boolean } = appSelector(
        (s) => s.status,
      );
      if (!status.boardingCompleted) {
        dispatch(setBoardingCompleted());
      }
    }

    if (checkPasswordSet) {
      const data: { isPasswordSet: boolean } = appSelector((s) => s.data);
      if (!data.isPasswordSet) {
        dispatch(passwordSet());
        dispatch(setEnableAppLock(true));
      }
    }

    if (checkOnBoarding || checkPasswordSet) {
      dispatch(unlock());
      dispatch(release());
    }

    const wallets = await serviceAccount.initWallets();
    let activeWallet: Wallet | undefined;
    if (walletId) {
      activeWallet = wallets.find((wallet) => wallet.id === walletId);
    } else {
      activeWallet = wallets.find((wallet) => wallet.type === walletType);
    }

    if (!activeWallet) return;
    await serviceAccount.reloadAccountsByWalletIdNetworkId(
      activeWallet?.id,
      networkId,
    );

    dispatch(
      setActiveIds({
        activeAccountId: account.id,
        activeWalletId: activeWallet.id,
        activeNetworkId: networkId,
      }),
    );

    if (shouldBackup) {
      serviceCloudBackup.requestBackup();
    }

    if (password) {
      const isOk = await serviceApp.verifyPassword(password);
      if (isOk) {
        await servicePassword.savePassword(password);
      }
    }

    this.backgroundApi.serviceNetwork.notifyChainChanged();
    this.backgroundApi.serviceAccount.notifyAccountsChanged();
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
    const devices = await engine.getHWDevices();
    const networkId = appSelector((s) => s.general.activeNetworkId) || '';
    const wallets: Wallet[] = appSelector((s) => s.runtime.wallets);
    let wallet = null;
    let account = null;

    const existDeviceId = devices.find(
      (device) =>
        device.mac === connectId && device.deviceId === features.device_id,
    )?.id;
    let walletExistButNoAccount = null;
    if (existDeviceId) {
      walletExistButNoAccount = wallets.find((w) => {
        const targetWallet = w.associatedDevice === existDeviceId;
        if (!targetWallet) return false;
        if (!w.accounts.length) return true;
        return false;
      });
    }

    if (walletExistButNoAccount) {
      wallet = walletExistButNoAccount;
    } else {
      wallet = await engine.createHWWallet({
        avatar: avatar ?? randomAvatar(),
        features,
        connectId,
      });
    }

    [account] = await engine.getAccounts(wallet.accounts, networkId);

    if (typeof account === 'undefined' && networkId) {
      // Network is neither btc nor evm, account is not by default created.
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
    const previousAccountId = appSelector((s) => s.general.activeAccountId);
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
    const { appSelector, engine, dispatch, serviceCloudBackup } =
      this.backgroundApi;
    const activeWalletId = appSelector((s) => s.general.activeWalletId);
    await engine.removeWallet(walletId, password ?? '');

    if (activeWalletId === walletId) {
      await this.autoChangeWallet();
    } else {
      await this.initWallets();
    }

    dispatch(setRefreshTS());
    if (!walletId.startsWith('hw')) {
      serviceCloudBackup.requestBackup();
    }
  }

  @backgroundMethod()
  async removeAccount(
    walletId: string,
    accountId: string,
    password: string | undefined,
  ) {
    const { appSelector, engine, dispatch, serviceCloudBackup } =
      this.backgroundApi;
    const activeAccountId = appSelector((s) => s.general.activeAccountId);
    await engine.removeAccount(accountId, password ?? '');
    await simpleDb.walletConnect.removeAccount({ accountId });

    if (activeAccountId === accountId) {
      await this.autoChangeAccount({ walletId });
    } else {
      const wallet: Wallet | null = await engine.getWallet(walletId);
      dispatch(updateWallet(wallet));
    }

    dispatch(setRefreshTS());
    if (!walletId.startsWith('hw')) {
      serviceCloudBackup.requestBackup();
    }
  }

  addressLabelCache: Record<string, string> = {};

  @backgroundMethod()
  async getAddressLabel({
    address,
  }: {
    address: string;
  }): Promise<{ label: string; address: string }> {
    if (this.addressLabelCache[address]) {
      return Promise.resolve({
        label: this.addressLabelCache[address],
        address,
      });
    }
    const wallets = await this.backgroundApi.engine.getWallets();
    const accountids = flatten(wallets.map((w) => w.accounts));
    const accounts = await this.backgroundApi.engine.getAccounts(accountids);
    const name = find(
      accounts,
      (a) => a.address.toLowerCase() === address.toLowerCase(),
    )?.name;
    const label = name ?? '';
    if (label && address) {
      this.addressLabelCache[address] = label;
    }
    return {
      label,
      address,
    };
  }
}

export default ServiceAccount;
