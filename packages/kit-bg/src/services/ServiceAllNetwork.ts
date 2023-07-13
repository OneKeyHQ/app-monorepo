import { debounce } from 'lodash';

import {
  allNetworksAccountRegex,
  generateFakeAllnetworksAccount,
} from '@onekeyhq/engine/src/managers/account';
import { getPath } from '@onekeyhq/engine/src/managers/derivation';
import { isAllNetworks } from '@onekeyhq/engine/src/managers/network';
import { isWalletCompatibleAllNetworks } from '@onekeyhq/engine/src/managers/wallet';
import type { Account } from '@onekeyhq/engine/src/types/account';
import {
  clearOverviewPendingTasks,
  setAllNetworksAccountsMap,
} from '@onekeyhq/kit/src/store/reducers/overview';
import {
  backgroundClass,
  backgroundMethod,
  bindThis,
} from '@onekeyhq/shared/src/background/backgroundDecorators';
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

    for (const [template, info] of Object.entries(accountDerivation)) {
      if (info?.accounts?.length) {
        for (const accountId of info.accounts) {
          const match = accountId.match(
            new RegExp(
              `${walletId}--${template}`.replace(INDEX_PLACEHOLDER, '(\\d+)'),
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
    const networks = appSelector((s) => s.runtime.networks ?? []);

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
    const activeAccountId = accountId ?? `${walletId}--${index}`;
    dispatch(
      clearOverviewPendingTasks(),
      setAllNetworksAccountsMap({
        accountId: activeAccountId,
        data: networkAccountsMap,
      }),
    );

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
}
