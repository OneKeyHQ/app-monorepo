import { debounce } from 'lodash';

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
  setAllNetworksAccountsLoading,
  setAllNetworksAccountsMap,
  setOverviewPortfolioUpdatedAt,
} from '@onekeyhq/kit/src/store/reducers/overview';
import { EOverviewScanTaskType } from '@onekeyhq/kit/src/views/Overview/types';
import {
  backgroundClass,
  backgroundMethod,
  bindThis,
} from '@onekeyhq/shared/src/background/backgroundDecorators';
import { FAKE_ALL_NETWORK } from '@onekeyhq/shared/src/config/fakeAllNetwork';
import { OnekeyNetwork } from '@onekeyhq/shared/src/config/networkIds';
import {
  IMPL_EVM,
  IMPL_SOL,
  INDEX_PLACEHOLDER,
} from '@onekeyhq/shared/src/engine/engineConsts';
import {
  AppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
import debugLogger from '@onekeyhq/shared/src/logger/debugLogger';

import ServiceBase from './ServiceBase';

@backgroundClass()
export default class ServiceAllNetwork extends ServiceBase {
  @bindThis()
  registerEvents() {
    appEventBus.on(AppEventBusNames.NetworkChanged, () => {
      this.refreshCurrentAllNetworksAccountMap();
    });
    appEventBus.on(AppEventBusNames.AccountChanged, () => {
      this.refreshCurrentAllNetworksAccountMap();
    });
    this.refreshCurrentAllNetworksAccountMap();
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

  @backgroundMethod()
  async getAllNetworkAccountIndex({ walletId }: { walletId: string }) {
    const { engine } = this.backgroundApi;
    // -1 means no account
    let maxAccountIndex = -1;

    const accountDerivation = await engine.dbApi.getAccountDerivationByWalletId(
      { walletId },
    );

    const isValidUtxoAccount = (account: Account) =>
      account.type === AccountType.UTXO &&
      !![
        OnekeyNetwork.btc,
        OnekeyNetwork.ltc,
        OnekeyNetwork.bch,
        OnekeyNetwork.doge,
        OnekeyNetwork.ada,
      ].find((nid) => isAccountCompatibleWithNetwork(account.id, nid));

    for (const [template, info] of Object.entries(accountDerivation)) {
      if (info?.accounts?.length) {
        const accounts = await engine.getAccounts(info.accounts);
        for (const account of accounts) {
          const replaceStr = isValidUtxoAccount(account)
            ? new RegExp(`${INDEX_PLACEHOLDER.replace(/\$/g, '\\$')}.*$`)
            : INDEX_PLACEHOLDER;

          const match = account.id.match(
            new RegExp(
              `${walletId}--${template}`.replace(replaceStr, '(\\d+)'),
            ),
          );

          const accountIndex = Number.parseInt(match?.[1] ?? '');

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
    const index = await this.getAllNetworkAccountIndex({
      walletId,
    });
    if (index === -1) {
      return [];
    }
    return new Array(index + 1).fill(1).map((_, i) =>
      generateFakeAllnetworksAccount({
        accountId: `${walletId}--${i}`,
      }),
    );
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
    accountId,
    accountIndex,
    walletId,
    refreshCurrentAccount = true,
  }: {
    accountId?: string;
    accountIndex?: number;
    walletId: string;
    refreshCurrentAccount?: boolean;
  }): Promise<Record<string, Account[]>> {
    const { engine, appSelector, dispatch, serviceOverview } =
      this.backgroundApi;
    const networkAccountsMap: Record<string, Account[]> = {};
    if (!isWalletCompatibleAllNetworks(walletId)) {
      return {};
    }
    let index: number | undefined;
    if (typeof accountIndex === 'number') {
      index = accountIndex;
    } else if (typeof accountId === 'string') {
      const match = accountId.match(allNetworksAccountRegex);
      if (match) {
        index = Number.parseInt(match[1]);
      }
    }

    if (typeof index !== 'number' || Number.isNaN(index)) {
      return {};
    }

    const wallet = await engine.getWallet(walletId);
    if (!wallet) {
      return {};
    }
    const activeAccountId = accountId ?? `${walletId}--${index}`;
    const networks = appSelector((s) => s.runtime.networks ?? []).filter(
      (n) =>
        n.enabled &&
        !n.isTestnet &&
        !n.settings?.validationRequired &&
        !n.settings.hideInAllNetworksMode &&
        networkIsPreset(n.id) &&
        ![OnekeyNetwork.fevm, OnekeyNetwork.cfxespace].includes(n.id),
    );

    dispatch(
      setAllNetworksAccountsLoading({
        accountId: activeAccountId,
        data: true,
      }),
    );

    for (const n of networks.filter(
      (item) =>
        item.enabled && !item.isTestnet && !item.settings.validationRequired,
    )) {
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
      if (filteredAccoutns?.length) {
        networkAccountsMap[n.id] = filteredAccoutns;
      }
    }

    const dispatchKey = `${FAKE_ALL_NETWORK.id}___${activeAccountId}`;

    const actions: any[] = [
      clearOverviewPendingTasks(),
      setAllNetworksAccountsMap({
        accountId: activeAccountId,
        data: networkAccountsMap,
      }),
    ];

    if (Object.keys(networkAccountsMap).length === 0) {
      // remove assets
      await simpleDb.accountPortfolios.setAllNetworksPortfolio({
        key: dispatchKey,
        scanTypes: [
          EOverviewScanTaskType.token,
          EOverviewScanTaskType.nfts,
          EOverviewScanTaskType.defi,
        ],
        data: {
          token: [],
          nfts: [],
          defi: [],
        },
      });
      actions.push(
        setOverviewPortfolioUpdatedAt({
          key: dispatchKey,
          data: {
            updatedAt: Date.now(),
          },
        }),
      );
    }

    dispatch(...actions);

    if (!refreshCurrentAccount) {
      return networkAccountsMap;
    }

    await serviceOverview.refreshCurrentAccount();
    return networkAccountsMap;
  }

  _refreshCurrentAllNetworksAccountMapWithDebounce = debounce(
    async () => {
      const { appSelector } = this.backgroundApi;
      try {
        await this.backgroundApi.serviceApp.waitForAppInited({
          logName: 'ServiceAllNetwork.refreshCurrentAllNetworksAccountMap',
        });
      } catch (error) {
        debugLogger.common.error(error);
      }
      const {
        activeWalletId: walletId,
        activeAccountId: accountId,
        activeNetworkId,
      } = appSelector((s) => s.general);
      if (!walletId || !accountId) {
        return;
      }
      if (!isAllNetworks(activeNetworkId)) {
        return;
      }
      const res = await this.generateAllNetworksWalletAccounts({
        walletId,
        accountId,
      });
      return res;
    },
    600,
    {
      leading: false,
      trailing: true,
    },
  );

  @backgroundMethod()
  refreshCurrentAllNetworksAccountMap() {
    return this._refreshCurrentAllNetworksAccountMapWithDebounce();
  }

  @backgroundMethod()
  async createAllNetworksFakeAccount({ walletId }: { walletId: string }) {
    const { appSelector, serviceAccount } = this.backgroundApi;
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

    if (accountIds.length >= 3) {
      throw new AllNetworksUpto3LimitsError('', {
        0: 3,
      });
    }

    let accountMaxIndex = 0;

    for (; accountMaxIndex < Math.min(maxIndex, 2); accountMaxIndex += 1) {
      if (!allNetworksAccountsMap?.[`${walletId}--${accountMaxIndex}`]) {
        break;
      }
    }

    const fakeNewAccountId = `${walletId}--${accountMaxIndex}`;

    if (allNetworksAccountsMap?.[fakeNewAccountId]) {
      throw new AllNetworksMinAccountsError('', {
        0: accountMaxIndex + 2,
      });
    }

    const account = await this.generateAllNetworksWalletAccounts({
      walletId,
      accountId: fakeNewAccountId,
    });

    await serviceAccount.autoChangeAccount({
      walletId,
    });

    return account;
  }

  @backgroundMethod()
  async deleteAllNetworksFakeAccount({ accountId }: { accountId: string }) {
    const { dispatch, serviceAccount } = this.backgroundApi;

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
}
