import simpleDb from '@onekeyhq/engine/src/dbs/simple/simpleDb';
import {
  AllNetworksMinAccountsError,
  AllNetworksUpto3LimitsError,
} from '@onekeyhq/engine/src/errors';
import {
  allNetworksAccountRegex,
  generateFakeAllnetworksAccount,
  getWalletIdFromAccountId,
  isAccountCompatibleWithNetwork,
} from '@onekeyhq/engine/src/managers/account';
import { getPath } from '@onekeyhq/engine/src/managers/derivation';
import { isAllNetworks } from '@onekeyhq/engine/src/managers/network';
import { isWalletCompatibleAllNetworks } from '@onekeyhq/engine/src/managers/wallet';
import { networkIsPreset } from '@onekeyhq/engine/src/presets';
import type { Account } from '@onekeyhq/engine/src/types/account';
import { AccountType } from '@onekeyhq/engine/src/types/account';
import {
  clearOverviewPendingTasks,
  removeAllNetworksAccountsMapByAccountId,
  removeMapNetworks,
  removeWalletAccountsMap,
  setAllNetworksAccountsMap,
} from '@onekeyhq/kit/src/store/reducers/overview';
import {
  setOverviewAccountIsUpdating,
  updateRefreshHomeOverviewTs,
} from '@onekeyhq/kit/src/store/reducers/refresher';
import type { NetworkWithAccounts } from '@onekeyhq/kit/src/views/ManageNetworks/types';
import { EOverviewScanTaskType } from '@onekeyhq/kit/src/views/Overview/types';
import {
  backgroundClass,
  backgroundMethod,
  bindThis,
} from '@onekeyhq/shared/src/background/backgroundDecorators';
import { FAKE_ALL_NETWORK } from '@onekeyhq/shared/src/config/fakeNetwork';
import { OnekeyNetwork } from '@onekeyhq/shared/src/config/networkIds';
import {
  IMPL_EVM,
  IMPL_SOL,
  INDEX_PLACEHOLDER,
  isLightningNetwork,
} from '@onekeyhq/shared/src/engine/engineConsts';
import {
  AppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
import debugLogger from '@onekeyhq/shared/src/logger/debugLogger';

import ServiceBase from './ServiceBase';

export const AllNetworksMaxAccounts = 3;

@backgroundClass()
export default class ServiceAllNetwork extends ServiceBase {
  @bindThis()
  registerEvents() {
    appEventBus.on(AppEventBusNames.NetworkChanged, () => {
      this.reloadCurrentAccount();
    });
    appEventBus.on(AppEventBusNames.AccountChanged, () => {
      this.reloadCurrentAccount();
    });
    this.reloadCurrentAccount();
  }

  @backgroundMethod()
  async switchWalletToCompatibleAllNetworks() {
    const { appSelector, serviceAccountSelector } = this.backgroundApi;
    let activeWalletId = appSelector((s) => s.accountSelector.walletId);
    const wallets = appSelector((s) => s.runtime.wallets);

    if (!isWalletCompatibleAllNetworks(activeWalletId)) {
      const newWalletId = wallets.find((w) =>
        isWalletCompatibleAllNetworks(w.id),
      )?.id;
      if (newWalletId) {
        await serviceAccountSelector.updateSelectedWallet(newWalletId);
        activeWalletId = newWalletId;
      }
    }

    return activeWalletId;
  }

  getAccountIndex(account: Account, template: string) {
    const isValidUtxoAccount =
      account.type === AccountType.UTXO &&
      !![
        OnekeyNetwork.btc,
        OnekeyNetwork.ltc,
        OnekeyNetwork.bch,
        OnekeyNetwork.doge,
        OnekeyNetwork.ada,
        OnekeyNetwork.nexa,
      ].find((nid) => isAccountCompatibleWithNetwork(account.id, nid));
    const replaceStr =
      isValidUtxoAccount || isLightningNetwork(account.coinType)
        ? new RegExp(`${INDEX_PLACEHOLDER.replace(/\$/g, '\\$')}.*$`)
        : INDEX_PLACEHOLDER;

    const walletId = getWalletIdFromAccountId(account.id);

    const match = account.id.match(
      new RegExp(`${walletId}--${template}`.replace(replaceStr, '(\\d+)')),
    );

    const accountIndex = Number.parseInt(match?.[1] ?? '');

    return accountIndex;
  }

  @backgroundMethod()
  async getAllNetworkAccountIndex({ walletId }: { walletId: string }) {
    const { engine } = this.backgroundApi;
    // -1 means no account
    let maxAccountIndex = -1;

    const accountDerivation = await engine.dbApi.getAccountDerivationByWalletId(
      { walletId },
    );

    for (const [template, info] of Object.entries(accountDerivation)) {
      if (info?.accounts?.length) {
        const accounts = await engine.getAccounts(info.accounts);
        for (const account of accounts) {
          const accountIndex = this.getAccountIndex(account, template);

          if (!Number.isNaN(accountIndex)) {
            maxAccountIndex = Math.max(accountIndex, maxAccountIndex);
          }
        }
      }
    }

    return maxAccountIndex;
  }

  @backgroundMethod()
  async getAllNetworksFakeAccounts({
    walletId,
  }: {
    walletId: string;
  }): Promise<Account[]> {
    const { appSelector } = this.backgroundApi;
    const map = appSelector((s) => s.overview.allNetworksAccountsMap);
    const accounts = Object.keys(map ?? {})
      .filter((accountId) => accountId.startsWith(walletId))
      .map((accountId) =>
        generateFakeAllnetworksAccount({
          accountId,
        }),
      )
      // @ts-ignore
      .sort((a, b) => a.index - b.index)
      .slice(0, AllNetworksMaxAccounts);

    return Promise.resolve(accounts);
  }

  compareAccountPath({
    path,
    template,
    impl,
    accountIndex,
  }: {
    path: string;
    template?: string;
    impl: string;
    accountIndex?: number;
  }) {
    if (!template || typeof accountIndex !== 'number') {
      return false;
    }
    let p: string;
    if ([IMPL_EVM, IMPL_SOL].includes(impl)) {
      p = template.replace(INDEX_PLACEHOLDER, accountIndex.toString());
    } else {
      const [purpose, coinType] = template
        .split('/')
        .slice(1)
        .map((m) => m.replace("'", ''));
      p = getPath(purpose, coinType, accountIndex);
    }
    return p === path;
  }

  @backgroundMethod()
  async generateAllNetworksWalletAccounts({
    accountIndex,
    walletId,
  }: {
    accountId?: string;
    accountIndex?: number;
    walletId: string;
    refreshCurrentAccount?: boolean;
  }): Promise<Record<string, Account[]>> {
    const { engine, appSelector, dispatch } = this.backgroundApi;
    const index = accountIndex;
    if (typeof index !== 'number' || Number.isNaN(index)) {
      return {};
    }
    const activeAccountId = `${walletId}--${index}`;
    const networkAccountsMap =
      appSelector(
        (s) => s.overview.allNetworksAccountsMap?.[activeAccountId],
      ) ?? {};

    const map: typeof networkAccountsMap = {};

    if (!isWalletCompatibleAllNetworks(walletId)) {
      return {};
    }

    const wallet = await engine.getWallet(walletId);
    if (!wallet) {
      return {};
    }

    const networks = appSelector((s) => s.runtime.networks ?? []).filter(
      (n) =>
        n.enabled &&
        !n.isTestnet &&
        !n.settings?.validationRequired &&
        !n.settings.hideInAllNetworksMode &&
        networkIsPreset(n.id) &&
        networkAccountsMap[n.id] &&
        ![OnekeyNetwork.fevm, OnekeyNetwork.cfxespace].includes(n.id),
    );

    for (const n of networks) {
      const accounts = await engine.getAccounts(wallet.accounts, n.id);
      const filteredAccoutns = accounts.filter((a) => {
        if (!a.template) {
          return false;
        }
        return this.compareAccountPath({
          path: a.path,
          template: a.template,
          impl: n.impl,
          accountIndex: index,
        });
      });
      map[n.id] = filteredAccoutns;
      if (!filteredAccoutns?.length) {
        delete map[n.id];
      }
    }

    dispatch(
      setAllNetworksAccountsMap({
        accountId: activeAccountId,
        data: map,
      }),
    );

    return map;
  }

  @backgroundMethod()
  async createAllNetworksFakeAccount({ walletId }: { walletId: string }) {
    const { appSelector, serviceAccount, dispatch } = this.backgroundApi;
    const maxIndex = await this.getAllNetworkAccountIndex({
      walletId,
    });

    if (maxIndex === -1) {
      throw new AllNetworksMinAccountsError('', {
        0: 1,
      });
    }

    const allNetworksAccountsMap = appSelector(
      (s) => s.overview.allNetworksAccountsMap,
    );

    const accountIds = Object.keys(allNetworksAccountsMap ?? {}).filter((n) =>
      n.startsWith(walletId),
    );

    if (accountIds.length >= AllNetworksMaxAccounts) {
      throw new AllNetworksUpto3LimitsError('', {
        0: AllNetworksMaxAccounts,
      });
    }

    let accountMaxIndex = 0;

    for (; accountMaxIndex < Math.min(maxIndex, 2); accountMaxIndex += 1) {
      if (
        typeof allNetworksAccountsMap?.[`${walletId}--${accountMaxIndex}`] ===
        'undefined'
      ) {
        break;
      }
    }

    const fakeNewAccountId = `${walletId}--${accountMaxIndex}`;

    if (allNetworksAccountsMap?.[fakeNewAccountId]) {
      throw new AllNetworksMinAccountsError('', {
        0: accountMaxIndex + 2,
      });
    }

    dispatch(
      setAllNetworksAccountsMap({
        accountId: fakeNewAccountId,
        data: null,
      }),
    );

    debugLogger.allNetworks.info(
      `[createAllNetworksFakeAccount] `,
      fakeNewAccountId,
    );
    await serviceAccount.autoChangeAccount({
      walletId,
    });
  }

  @backgroundMethod()
  async deleteAllNetworksFakeAccount({ accountId }: { accountId: string }) {
    const { dispatch, serviceAccount } = this.backgroundApi;

    debugLogger.allNetworks.info(`[deleteAllNetworksFakeAccount] `, accountId);
    dispatch(
      removeAllNetworksAccountsMapByAccountId({
        accountId,
      }),
    );

    await serviceAccount.autoChangeAccount({
      walletId: getWalletIdFromAccountId(accountId),
    });

    return Promise.resolve(undefined);
  }

  @backgroundMethod()
  async getSelectableNetworkAccounts({ accountId }: { accountId: string }) {
    const { appSelector, engine, dispatch } = this.backgroundApi;

    if (!accountId) {
      return;
    }

    let index: number | undefined;
    const match = accountId.match(allNetworksAccountRegex);
    if (match) {
      index = Number.parseInt(match[1]);
    }

    if (typeof index !== 'number' || Number.isNaN(index)) {
      return;
    }

    const walletId = getWalletIdFromAccountId(accountId);

    const wallet = await engine.getWallet(walletId);

    if (!wallet) {
      return;
    }

    const selectedNetorkAccountsMap =
      appSelector((s) => s.overview.allNetworksAccountsMap ?? {})[accountId] ??
      {};

    const networks = appSelector((s) => s.runtime.networks ?? []).filter(
      (n) =>
        n.enabled &&
        !n.isTestnet &&
        !n.settings?.validationRequired &&
        !n.settings.hideInAllNetworksMode &&
        networkIsPreset(n.id) &&
        !isAllNetworks(n.id) &&
        ![OnekeyNetwork.fevm, OnekeyNetwork.cfxespace].includes(n.id),
    );

    const networksWithAccounts: NetworkWithAccounts[] = [];

    for (const n of networks) {
      let accounts = selectedNetorkAccountsMap?.[n.id];
      if (accounts?.length) {
        networksWithAccounts.push({
          ...n,
          selected: true,
          accounts,
        });
        // eslint-disable-next-line no-continue
        continue;
      }
      accounts = await engine.getAccounts(wallet.accounts, n.id);
      const filteredAccoutns = accounts.filter((a) => {
        if (!a.template) {
          return false;
        }
        return this.compareAccountPath({
          path: a.path,
          template: a.template,
          impl: n.impl,
          accountIndex: index,
        });
      });
      if (filteredAccoutns?.length) {
        networksWithAccounts.push({
          ...n,
          selected: false,
          accounts: filteredAccoutns,
        });
      }
    }

    const disabledNetworkIds = Object.keys(selectedNetorkAccountsMap).filter(
      (id) => !networks.find((n) => n.id === id),
    );

    if (disabledNetworkIds.length) {
      debugLogger.allNetworks.warn(
        `[getSelectableNetworkAccounts] `,
        disabledNetworkIds.join(','),
      );
      dispatch(
        removeMapNetworks({
          accountId,
          networkIds: disabledNetworkIds,
        }),
      );
    }

    return networksWithAccounts;
  }

  @backgroundMethod()
  async reloadCurrentAccount() {
    const { appSelector, serviceOverview, dispatch } = this.backgroundApi;
    const { activeNetworkId, activeAccountId } = appSelector((s) => s.general);
    if (
      !activeAccountId ||
      !activeNetworkId ||
      !isAllNetworks(activeNetworkId)
    ) {
      return;
    }

    const networkAccountsMap =
      appSelector(
        (s) => s.overview.allNetworksAccountsMap?.[activeAccountId],
      ) ?? {};

    const actions: any[] = [
      setOverviewAccountIsUpdating({
        accountId: activeAccountId,
        data: true,
      }),
      clearOverviewPendingTasks(),
    ];

    if (Object.keys(networkAccountsMap).length === 0) {
      const dispatchKey = `${FAKE_ALL_NETWORK.id}___${activeAccountId}`;
      const scanTypes = [
        EOverviewScanTaskType.token,
        EOverviewScanTaskType.nfts,
        EOverviewScanTaskType.defi,
      ];
      // remove assets
      await simpleDb.accountPortfolios.setAllNetworksPortfolio({
        key: dispatchKey,
        scanTypes,
        data: {
          token: [],
          nfts: [],
          defi: [],
        },
      });

      actions.push(updateRefreshHomeOverviewTs(scanTypes));
    }

    dispatch(...actions);

    return serviceOverview.refreshCurrentAccount();
  }

  @backgroundMethod()
  async onNetworksDisabled({ networkIds }: { networkIds: string[] }) {
    const { dispatch } = this.backgroundApi;

    debugLogger.allNetworks.info(`[onNetworksDisabled] `, networkIds.join(','));
    dispatch(
      removeMapNetworks({
        networkIds,
      }),
    );

    return this.reloadCurrentAccount();
  }

  @backgroundMethod()
  async onAccountChanged({
    account,
    networkId,
  }: {
    account: Account;
    networkId: string;
  }) {
    const { dispatch, appSelector } = this.backgroundApi;

    const network = appSelector((s) => s.runtime.networks).find(
      (n) => n.id === networkId,
    );

    if (!network) {
      debugLogger.allNetworks.warn(
        `[onAccountChanged] network ${networkId} not found`,
      );
      return;
    }

    const index = this.getAccountIndex(account, account?.template ?? '');

    if (index >= AllNetworksMaxAccounts || index < 0 || Number.isNaN(index)) {
      debugLogger.allNetworks.warn(
        `[onAccountChanged] invalid index networkId=${networkId}`,
        account,
      );
      return;
    }

    const walletId = getWalletIdFromAccountId(account?.id);

    const current = appSelector(
      (s) => s.overview.allNetworksAccountsMap?.[`${walletId}--${index}`],
    );

    if (!current) {
      return;
    }

    const accountId = `${walletId}--${index}`;

    const map = await this.generateAllNetworksWalletAccounts({
      accountIndex: index,
      walletId,
    });

    debugLogger.allNetworks.info(`[onAccountChanged] generated map`, map);
    dispatch(
      setAllNetworksAccountsMap({
        accountId,
        data: map,
      }),
    );

    const activeAccountId = appSelector((s) => s.general.activeAccountId);

    if (accountId !== activeAccountId) {
      return;
    }

    return this.reloadCurrentAccount();
  }

  @backgroundMethod()
  async onWalletRemoved({ walletIds }: { walletIds: string[] }) {
    const { dispatch } = this.backgroundApi;
    debugLogger.allNetworks.info(`[onWalletRemoved] `, walletIds.join(','));
    await simpleDb.accountPortfolios.removeWalletData(walletIds);
    dispatch(removeWalletAccountsMap({ walletIds }));
  }

  @backgroundMethod()
  async updateAllNetworksAccountsMap({
    accountId,
    selectedNetworkAccounts,
  }: {
    accountId: string;
    selectedNetworkAccounts: NetworkWithAccounts[];
  }) {
    if (!selectedNetworkAccounts) {
      return;
    }
    const { dispatch } = this.backgroundApi;

    dispatch(
      setAllNetworksAccountsMap({
        accountId,
        data: selectedNetworkAccounts.reduce((sum, n) => {
          sum[n.id] = n.accounts;
          return sum;
        }, {} as Record<string, Account[]>),
      }),
    );

    return this.reloadCurrentAccount();
  }
}
