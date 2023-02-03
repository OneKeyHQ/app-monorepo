import { find, flatten } from 'lodash';

import simpleDb from '@onekeyhq/engine/src/dbs/simple/simpleDb';
import { OneKeyErrorClassNames } from '@onekeyhq/engine/src/errors';
import { isAccountCompatibleWithNetwork } from '@onekeyhq/engine/src/managers/account';
import {
  generateNetworkIdByChainId,
  getCoinTypeFromNetworkId,
  parseNetworkId,
} from '@onekeyhq/engine/src/managers/network';
import type { IAccount, INetwork, IWallet } from '@onekeyhq/engine/src/types';
import type { Account, DBAccount } from '@onekeyhq/engine/src/types/account';
import type { Wallet, WalletType } from '@onekeyhq/engine/src/types/wallet';
import { getActiveWalletAccount } from '@onekeyhq/kit/src/hooks/redux';
import { getManageNetworks } from '@onekeyhq/kit/src/hooks/useManageNetworks';
import { passwordSet, release } from '@onekeyhq/kit/src/store/reducers/data';
import {
  changeActiveAccount,
  changeActiveExternalWalletName,
  setActiveIds,
} from '@onekeyhq/kit/src/store/reducers/general';
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
import {
  setBoardingCompleted,
  setBoardingNotCompleted,
  unlock,
} from '@onekeyhq/kit/src/store/reducers/status';
import { DeviceNotOpenedPassphrase } from '@onekeyhq/kit/src/utils/hardware/errors';
import { wait } from '@onekeyhq/kit/src/utils/helper';
import {
  backgroundClass,
  backgroundMethod,
} from '@onekeyhq/shared/src/background/backgroundDecorators';
import { OnekeyNetwork } from '@onekeyhq/shared/src/config/networkIds';
import {
  COINTYPE_ETH,
  IMPL_CFX,
  IMPL_COSMOS,
  IMPL_FIL,
} from '@onekeyhq/shared/src/engine/engineConsts';
import { isHardwareWallet } from '@onekeyhq/shared/src/engine/engineUtils';
import {
  AppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
import { startTrace, stopTrace } from '@onekeyhq/shared/src/perf/perfTrace';
import timelinePerfTrace, {
  ETimelinePerfNames,
} from '@onekeyhq/shared/src/perf/timelinePerfTrace';
import type { Avatar } from '@onekeyhq/shared/src/utils/emojiUtils';
import { randomAvatar } from '@onekeyhq/shared/src/utils/emojiUtils';
import type { IOneKeyDeviceFeatures } from '@onekeyhq/shared/types';

import ServiceBase from './ServiceBase';

import type ProviderApiBase from '../providers/ProviderApiBase';
import type { IServiceBaseProps } from './ServiceBase';

if (process.env.NODE_ENV !== 'production') {
  // @ts-ignore
  global.$$setBoardingNotCompleted = setBoardingNotCompleted;
  // @ts-ignore
  global.$$setBoardingCompleted = setBoardingCompleted;
}

const REFRESH_ACCOUNT_IMPL = [IMPL_COSMOS, IMPL_FIL, IMPL_CFX];

@backgroundClass()
class ServiceAccount extends ServiceBase {
  constructor(props: IServiceBaseProps) {
    super(props);
    appEventBus.on(AppEventBusNames.AccountNameChanged, () => {
      this.addressLabelCache = {};
    });
  }

  shouldForceRefreshAccount(networkId?: string): boolean {
    if (!networkId) return false;
    return REFRESH_ACCOUNT_IMPL.includes(parseNetworkId(networkId).impl ?? '');
  }

  @backgroundMethod()
  async changeActiveAccount({
    accountId,
    walletId,
    extraActions,
    shouldReloadAccountsWhenWalletChanged = true,
  }: {
    accountId: string | null;
    walletId: string | null;
    extraActions?: any[];
    shouldReloadAccountsWhenWalletChanged?: boolean;
  }) {
    const { dispatch, appSelector } = this.backgroundApi;
    const { activeNetworkId, activeWalletId } = appSelector((s) => s.general);
    // await this.initWallets();
    if (shouldReloadAccountsWhenWalletChanged && activeWalletId !== walletId) {
      await this.reloadAccountsByWalletIdNetworkId(walletId, activeNetworkId);
    }
    dispatch(
      changeActiveAccount({
        activeAccountId: accountId,
        activeWalletId: walletId,
      }),
      ...(extraActions || []),
    );
    this.changeActiveExternalWalletName(accountId);
    this.notifyAccountsChanged();
  }

  @backgroundMethod()
  async initWallets({ noDispatch } = { noDispatch: false }) {
    const { engine, dispatch, appSelector } = this.backgroundApi;
    const displayPassphraseWalletIdList = appSelector(
      (s) => s.runtime.displayPassphraseWalletIdList,
    );
    const wallets = await engine.getWallets({
      displayPassphraseWalletIds: displayPassphraseWalletIdList,
    });
    if (!noDispatch) {
      dispatch(updateWallets(wallets));
    }
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
    { noDispatch } = { noDispatch: false },
  ) {
    if (!walletId || !networkId) return;
    const { engine, dispatch } = this.backgroundApi;
    const wallet = await engine.getWallet(walletId);
    const accountIds = wallet.accounts;
    const accounts = await engine.getAccounts(accountIds, networkId);
    if (!noDispatch) {
      dispatch(updateAccounts(accounts));
    }
    return accounts;
  }

  @backgroundMethod()
  async autoChangeAccount({
    walletId,
    shouldUpdateWallets,
    skipIfSameWallet,
  }: {
    walletId: string;
    shouldUpdateWallets?: boolean;
    skipIfSameWallet?: boolean;
  }) {
    const { dispatch, engine, serviceAccount, appSelector } =
      this.backgroundApi;
    if (!walletId) {
      return;
    }
    const wallet: Wallet | null = await engine.getWallet(walletId);

    // ATTENTION: update redux runtime.wallets may cause performance issue, make sure you really need this
    if (shouldUpdateWallets) {
      dispatch(updateWallet(wallet));
    }

    const activeNetworkId = appSelector((s) => s.general.activeNetworkId);
    const activeAccountId = appSelector((s) => s.general.activeAccountId);

    let accountId: string | null = null;
    if (wallet && activeNetworkId && wallet.accounts.length > 0) {
      const accountsInWalletAndNetwork = await engine.getAccounts(
        wallet.accounts,
        activeNetworkId,
      );
      accountId = accountsInWalletAndNetwork?.[0]?.id ?? null;
      if (
        skipIfSameWallet &&
        accountsInWalletAndNetwork.find((item) => item.id === activeAccountId)
      ) {
        return;
      }
    }
    await serviceAccount.changeActiveAccount({
      accountId,
      walletId,
    });
  }

  @backgroundMethod()
  async notifyAccountsChanged(): Promise<void> {
    await this.backgroundApi.walletConnect.notifySessionChanged();
    await wait(600);
    Object.values(this.backgroundApi.providers).forEach(
      (provider: ProviderApiBase) => {
        provider.notifyDappAccountsChanged({
          send: this.backgroundApi.sendForProvider(provider.providerName),
        });
      },
    );
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
    const { id: walletId, accounts } =
      // wallet not empty?
      wallets.find(($wallet) => $wallet.accounts.length > 0) ??
        // HD or HW type?
        wallets.find(($wallet) => ['hw', 'hd'].includes($wallet.type)) ??
        // imported or watching?
        wallets.find(($wallet) =>
          ['imported', 'watching'].includes($wallet.type),
        ) ?? { id: null, accounts: [] };

    if (walletId && accounts && accounts.length) {
      this.changeActiveAccount({ accountId: null, walletId });
    } else {
      this.changeActiveAccount({ accountId: null, walletId: null });
    }
  }

  @backgroundMethod()
  async createHDWallet({
    password,
    mnemonic,
    avatar,
    dispatchActionDelay,
    postCreatedDelay,
    isAutoAddAllNetworkAccounts,
  }: {
    password: string;
    mnemonic?: string;
    avatar?: Avatar;
    dispatchActionDelay?: number;
    postCreatedDelay?: number;
    isAutoAddAllNetworkAccounts?: boolean;
  }) {
    const { dispatch, engine, appSelector, serviceAccount } =
      this.backgroundApi;

    timelinePerfTrace.mark({
      name: ETimelinePerfNames.createHDWallet,
      title: 'serviceAccount.createHDWallet >> start',
    });

    const { networkId } = getActiveWalletAccount();

    startTrace('engine.createHDWallet');
    const wallet = await engine.createHDWallet({
      password,
      mnemonic,
      avatar: avatar ?? randomAvatar(),
      autoAddAccountNetworkId: networkId,
      isAutoAddAllNetworkAccounts,
    });
    stopTrace('engine.createHDWallet');

    timelinePerfTrace.mark({
      name: ETimelinePerfNames.createHDWallet,
      title: 'serviceAccount.createHDWallet >> engine done',
    });

    const data: { isPasswordSet: boolean } = appSelector((s) => s.data);
    const status: { boardingCompleted: boolean } = appSelector((s) => s.status);
    const actions: any[] = [];
    if (!status.boardingCompleted) {
      actions.push(setBoardingCompleted());
    }
    if (!data.isPasswordSet) {
      actions.push(passwordSet());
      actions.push(setEnableAppLock(true));
    }
    actions.push(unlock());
    actions.push(release());

    const wallets = await serviceAccount.initWallets({ noDispatch: true });
    actions.push(updateWallets(wallets));

    timelinePerfTrace.mark({
      name: ETimelinePerfNames.createHDWallet,
      title: 'serviceAccount.createHDWallet >> initWallets DONE',
    });

    if (dispatchActionDelay) {
      setTimeout(() => dispatch(...actions), dispatchActionDelay);
    } else {
      dispatch(...actions);
    }

    if (postCreatedDelay) {
      setTimeout(() => {
        this.postHDWalletCreated({
          wallet,
          password,
        });
      }, postCreatedDelay);
    } else {
      this.postHDWalletCreated({
        wallet,
        password,
      });
    }

    timelinePerfTrace.mark({
      name: ETimelinePerfNames.createHDWallet,
      title: 'serviceAccount.createHDWallet >> end',
    });

    return wallet;
  }

  postHDWalletCreated({
    wallet,
    password,
  }: {
    wallet: IWallet;
    password: string;
  }) {
    const { serviceAccount, serviceApp, servicePassword, serviceCloudBackup } =
      this.backgroundApi;

    serviceAccount.autoChangeAccount({ walletId: wallet.id });

    (async () => {
      const isOk = await serviceApp.verifyPassword(password);
      if (isOk) {
        servicePassword.savePassword(password);
      }
    })();

    serviceCloudBackup.requestBackup();
  }

  @backgroundMethod()
  async addHDAccounts(
    password: string,
    walletId: string,
    networkId: string,
    index?: number[],
    names?: string[],
    purpose?: number,
    skipRepeat = false,
  ) {
    const { engine } = this.backgroundApi;
    const accounts = await engine.addHdOrHwAccounts({
      password,
      walletId,
      networkId,
      indexes: index,
      names,
      purpose,
      skipRepeat,
    });

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
  async autoAddFirstHdOrHwAccount({
    wallet,
    networkId,
  }: {
    wallet: IWallet;
    networkId: string;
  }) {
    const { engine, servicePassword } = this.backgroundApi;
    const password = await servicePassword.getPassword();
    if (
      password &&
      networkId &&
      wallet.id &&
      (wallet.type === 'hd' || wallet.type === 'hw')
    ) {
      try {
        const accountsInWalletAndNetwork = await engine.getAccounts(
          wallet.accounts,
          networkId,
        );
        if (accountsInWalletAndNetwork.length) {
          return;
        }
        const accounts = await engine.addHdOrHwAccounts({
          password,
          walletId: wallet.id,
          networkId,
          indexes: [0],
          isAddInitFirstAccountOnly: true,
        });
        const activeAccount = accounts[0];
        await this.postAccountAdded({
          networkId,
          account: activeAccount,
          walletType: wallet.type,
          walletId: wallet.id,
          checkOnBoarding: false,
          checkPasswordSet: false,
          shouldBackup: false,
          password,
        });
      } catch (error) {
        console.error(error);
      }
    }
  }

  @backgroundMethod()
  async addTemporaryWatchAccount({ address }: { address: string }) {
    const { engine } = this.backgroundApi;
    const { watchingWallet } = getActiveWalletAccount();
    const id = watchingWallet?.nextAccountIds?.global;
    const name = id ? `Account #${id}` : '';
    const networkId = OnekeyNetwork.eth;
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
    name?: string;
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
      networkId = OnekeyNetwork.eth;
    }

    const { engine } = this.backgroundApi;

    if (!name) {
      const externalWallet = await engine.getExternalWallet();
      const nextAccountId = externalWallet?.nextAccountIds?.global;
      // eslint-disable-next-line no-param-reassign
      name = nextAccountId ? `External #${nextAccountId}` : '';
    }

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

    return { account, networkId };
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

    const actions = [];

    if (checkOnBoarding) {
      const status: { boardingCompleted: boolean } = appSelector(
        (s) => s.status,
      );
      if (!status.boardingCompleted) {
        actions.push(setBoardingCompleted());
      }
    }

    if (checkPasswordSet) {
      const data: { isPasswordSet: boolean } = appSelector((s) => s.data);
      if (!data.isPasswordSet) {
        actions.push(passwordSet());
        actions.push(setEnableAppLock(true));
      }
    }

    if (checkOnBoarding || checkPasswordSet) {
      actions.push(unlock());
      actions.push(release());
    }

    const wallets = await serviceAccount.initWallets({ noDispatch: true });
    actions.push(updateWallets(wallets));
    let activeWallet: Wallet | undefined;
    if (walletId) {
      activeWallet = wallets.find((wallet) => wallet.id === walletId);
    } else {
      activeWallet = wallets.find((wallet) => wallet.type === walletType);
    }

    if (!activeWallet) {
      dispatch(...actions);
      return;
    }

    const accounts = await serviceAccount.reloadAccountsByWalletIdNetworkId(
      activeWallet?.id,
      networkId,
      { noDispatch: true },
    );
    if (accounts) {
      actions.push(updateAccounts(accounts));
    }

    if (shouldBackup) {
      serviceCloudBackup.requestBackup();
    }

    if (password) {
      const isOk = await serviceApp.verifyPassword(password);
      if (isOk) {
        await servicePassword.savePassword(password);
      }
    }

    dispatch(
      ...actions,
      setActiveIds({
        activeAccountId: account.id,
        activeWalletId: activeWallet.id,
        activeNetworkId: networkId,
      }),
    );

    this.backgroundApi.serviceNetwork.notifyChainChanged();
    this.backgroundApi.serviceAccount.notifyAccountsChanged();
  }

  @backgroundMethod()
  async createHWWallet({
    features,
    avatar,
    connectId,
    onlyPassphrase,
  }: {
    features: IOneKeyDeviceFeatures;
    avatar?: Avatar;
    connectId: string;
    onlyPassphrase?: boolean;
  }) {
    const { dispatch, engine, serviceAccount, serviceHardware, appSelector } =
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

    const passphraseState = await serviceHardware.getPassphraseState(connectId);
    if (!!onlyPassphrase && !passphraseState) {
      throw new DeviceNotOpenedPassphrase({
        connectId,
        deviceId: features.device_id ?? undefined,
      });
    }

    if (existDeviceId) {
      walletExistButNoAccount = wallets.find((w) => {
        const targetWallet =
          w.associatedDevice === existDeviceId &&
          w.passphraseState === passphraseState;

        if (!targetWallet) return false;
        if (!w.accounts.length) return true;
        return false;
      });
    }

    let walletName: string | undefined;
    if (passphraseState) {
      if (existDeviceId) {
        const size = (
          await engine.getWallets({
            includeAllPassphraseWallet: true,
          })
        ).filter(
          (w) => w.associatedDevice === existDeviceId && w.passphraseState,
        ).length;
        walletName = `Hidden Wallet #${size + 1}`;
      } else {
        walletName = 'Hidden Wallet #1';
      }
    }

    if (walletExistButNoAccount) {
      wallet = walletExistButNoAccount;
    } else {
      try {
        wallet = await engine.createHWWallet({
          name: walletName,
          avatar: avatar ?? randomAvatar(),
          features,
          connectId,
          passphraseState,
        });
      } catch (e: any) {
        const { className, data } = e || {};
        if (className === OneKeyErrorClassNames.OneKeyAlreadyExistWalletError) {
          const { walletId: existsWalletId } = data || {};
          serviceAccount.initWallets();
          serviceAccount.autoChangeAccount({
            walletId: existsWalletId ?? null,
          });
        }
        throw e;
      }
    }

    [account] = await engine.getAccounts(wallet.accounts, networkId);

    if (typeof account === 'undefined' && networkId) {
      // Network is neither btc nor evm, account is not by default created.
      try {
        const accounts = await engine.addHdOrHwAccounts({
          password: 'Undefined',
          walletId: wallet.id,
          networkId,
        });
        if (accounts.length > 0) {
          const $account = accounts[0];
          account = $account;
        }
      } catch (error) {
        // TODO need to handle this error
      }
    }

    const walletId = wallet?.id;
    const accountId = account?.id;

    const status: { boardingCompleted: boolean } = appSelector((s) => s.status);
    const actions = [];
    if (!status.boardingCompleted) {
      actions.push(setBoardingCompleted());
    }
    dispatch(...actions, unlock(), release());

    await this.initWallets();

    serviceAccount.changeActiveAccount({
      accountId: accountId ?? null,
      walletId: walletId ?? null,
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
    timelinePerfTrace.mark({
      name: ETimelinePerfNames.removeWallet,
      title: 'ServiceAccount.removeWallet >> start',
    });

    const { appSelector, engine } = this.backgroundApi;
    const activeWalletId = appSelector((s) => s.general.activeWalletId);

    const wallet = await engine.getWallet(walletId);
    const accounts = await engine.getAccounts(wallet.accounts);
    timelinePerfTrace.mark({
      name: ETimelinePerfNames.removeWallet,
      title: 'ServiceAccount.removeWallet >> engine.getAccounts  DONE',
    });

    await engine.removeWallet(walletId, password ?? '');
    timelinePerfTrace.mark({
      name: ETimelinePerfNames.removeWallet,
      title: 'ServiceAccount.removeWallet >> engine.removeWallet  DONE',
    });

    setTimeout(
      () =>
        this.postWalletRemoved({
          accounts,
          activeWalletId,
          removedWalletId: walletId,
        }),
      600,
    );

    timelinePerfTrace.mark({
      name: ETimelinePerfNames.removeWallet,
      title: 'ServiceAccount.removeWallet >> end',
    });
  }

  async postWalletRemoved({
    accounts,
    activeWalletId,
    removedWalletId,
  }: {
    accounts: IAccount[];
    activeWalletId: string | undefined | null;
    removedWalletId: string;
  }) {
    const { serviceNotification, dispatch, serviceCloudBackup } =
      this.backgroundApi;

    timelinePerfTrace.mark({
      name: ETimelinePerfNames.postWalletRemoved,
      title: 'ServiceAccount.postWalletRemoved >> start =================== ',
    });

    if (activeWalletId && activeWalletId === removedWalletId) {
      // autoChangeWallet if remove current wallet
      // **** multiple dispatch cause UI reload performance issue
      await this.autoChangeWallet();
      timelinePerfTrace.mark({
        name: ETimelinePerfNames.postWalletRemoved,
        title: 'ServiceAccount.postWalletRemoved >> autoChangeWallet DONE',
      });
    } else {
      // **** multiple dispatch cause UI reload performance issue
      await this.initWallets();
      timelinePerfTrace.mark({
        name: ETimelinePerfNames.postWalletRemoved,
        title: 'ServiceAccount.postWalletRemoved >> initWallets DONE',
      });
    }

    serviceNotification.removeAccountDynamicBatch({
      addressList: accounts
        .filter((a) => a.coinType === COINTYPE_ETH)
        .map((a) => a.address),
    });
    timelinePerfTrace.mark({
      name: ETimelinePerfNames.postWalletRemoved,
      title:
        'ServiceAccount.postWalletRemoved >> removeAccountDynamicBatch DONE',
    });

    if (!removedWalletId.startsWith('hw')) {
      // **** multiple dispatch cause UI reload performance issue
      serviceCloudBackup.requestBackup();
    }
    timelinePerfTrace.mark({
      name: ETimelinePerfNames.postWalletRemoved,
      title: 'ServiceAccount.postWalletRemoved >> requestBackup DONE',
    });

    // **** multiple dispatch cause UI reload performance issue
    dispatch(setRefreshTS());

    await wait(10);
    timelinePerfTrace.mark({
      name: ETimelinePerfNames.postWalletRemoved,
      title: 'ServiceAccount.postWalletRemoved >> end',
    });
    return null;
  }

  @backgroundMethod()
  async removeAccount(
    walletId: string,
    accountId: string,
    password: string | undefined,
  ) {
    const {
      appSelector,
      engine,
      dispatch,
      serviceCloudBackup,
      serviceNotification,
    } = this.backgroundApi;
    const account = await this.getAccount({
      walletId,
      accountId,
    });
    if (account) {
      serviceNotification.removeAccountDynamicBatch({
        addressList: [account.address],
      });
    }
    const activeAccountId = appSelector((s) => s.general.activeAccountId);
    await engine.removeAccount(accountId, password ?? '');
    await simpleDb.walletConnect.removeAccount({ accountId });

    const actions = [];
    if (activeAccountId === accountId) {
      await this.autoChangeAccount({ walletId, shouldUpdateWallets: true });
    } else {
      const wallet: Wallet | null = await engine.getWallet(walletId);
      actions.push(updateWallet(wallet));
    }

    dispatch(...actions, setRefreshTS());
    if (!walletId.startsWith('hw')) {
      serviceCloudBackup.requestBackup();
    }
  }

  addressLabelCache: Record<string, string> = {};

  // getAccountNameByAddress
  @backgroundMethod()
  async getAddressLabel({
    address,
  }: {
    address: string;
  }): Promise<{ label: string; address: string }> {
    const { wallet, walletId } = getActiveWalletAccount();
    const cacheKey = `${address}@${walletId || ''}`;
    if (this.addressLabelCache[cacheKey]) {
      return Promise.resolve({
        label: this.addressLabelCache[cacheKey],
        address,
      });
    }
    const findNameLabelByAccountIds = async (accountIds: string[]) => {
      const accounts = await this.backgroundApi.engine.getAccounts(accountIds);
      const name = find(
        accounts,
        (a) => a.address.toLowerCase() === address.toLowerCase(),
      )?.name;
      const label = name ?? '';
      if (label && address) {
        this.addressLabelCache[cacheKey] = label;
      }
      return label;
    };
    // TODO search from wallet in params
    // search from active wallet
    if (wallet && wallet.accounts && wallet.accounts.length) {
      const label = await findNameLabelByAccountIds(wallet.accounts);
      if (label) {
        return {
          label,
          address,
        };
      }
    }
    // search from all wallets
    const wallets = await this.backgroundApi.engine.getWallets({
      includeAllPassphraseWallet: true,
    });
    const accountIds = flatten(wallets.map((w) => w.accounts));
    const label = await findNameLabelByAccountIds(accountIds);
    return {
      label,
      address,
    };
  }

  @backgroundMethod()
  async getAccountByAddress({ address }: { address: string }) {
    const { engine, appSelector } = this.backgroundApi;
    const displayPassphraseWalletIdList = appSelector(
      (s) => s.runtime.displayPassphraseWalletIdList,
    );
    const wallets = await engine.getWallets({
      displayPassphraseWalletIds: displayPassphraseWalletIdList,
    });
    for (let i = 0; i < wallets.length; i += 1) {
      const wallet = wallets[i];
      const accounts = await engine.getAccounts(wallet.accounts);
      const target = accounts.find((item) => item.address === address);
      if (target) {
        return target;
      }
    }
  }

  @backgroundMethod()
  async getAccount({
    walletId,
    accountId,
  }: {
    walletId: string;
    accountId: string;
  }) {
    const { engine } = this.backgroundApi;
    const wallet = await engine.getWallet(walletId);
    const accounts = await engine.getAccounts(wallet.accounts);
    return accounts.find((item) => item.id === accountId);
  }

  @backgroundMethod()
  async changeActiveAccountByAccountId(accountId: string) {
    const { appSelector } = this.backgroundApi;
    const { wallets } = appSelector((s) => s.runtime);
    const wallet = wallets.find((item) => item.accounts.includes(accountId));
    if (!wallet) {
      return;
    }
    return this.changeActiveAccount({
      accountId,
      walletId: wallet.id,
    });
  }

  @backgroundMethod()
  async changeActiveExternalWalletName(accountId: string | null) {
    const { dispatch, appSelector } = this.backgroundApi;
    const activeWalletId = appSelector((s) => s.general.activeWalletId);
    const activeAccountId = appSelector((s) => s.general.activeAccountId);
    let activeExternalWalletName = null;
    if (
      activeWalletId === 'external' &&
      accountId &&
      accountId === activeAccountId
    ) {
      const result =
        await this.backgroundApi.serviceWalletConnect.getWalletConnectSessionOfAccount(
          {
            accountId,
          },
        );
      activeExternalWalletName = result.accountInfo?.walletName;
    }

    dispatch(changeActiveExternalWalletName(activeExternalWalletName ?? ''));
  }
}

export default ServiceAccount;
