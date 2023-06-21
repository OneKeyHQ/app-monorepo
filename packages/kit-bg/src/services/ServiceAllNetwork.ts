import {
  allNetworksAccountRegex,
  generateFakeAllnetworksAccount,
} from '@onekeyhq/engine/src/managers/account';
import { getPath } from '@onekeyhq/engine/src/managers/derivation';
import { isWalletCompatibleAllNetworks } from '@onekeyhq/engine/src/managers/wallet';
import type { Account } from '@onekeyhq/engine/src/types/account';
import {
  backgroundClass,
  backgroundMethod,
} from '@onekeyhq/shared/src/background/backgroundDecorators';
import {
  IMPL_EVM,
  IMPL_SOL,
  INDEX_PLACEHOLDER,
} from '@onekeyhq/shared/src/engine/engineConsts';

import ServiceBase from './ServiceBase';

@backgroundClass()
export default class ServiceAllNetwork extends ServiceBase {
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
  async getAllNetworksWalletAccounts({
    accountId,
    accountIndex,
    walletId,
  }: {
    accountId?: string;
    accountIndex?: number;
    walletId: string;
  }) {
    const networkAccountsMap: Record<string, Account[]> = {};
    if (!isWalletCompatibleAllNetworks(walletId)) {
      return networkAccountsMap;
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
      return networkAccountsMap;
    }

    const { engine, appSelector } = this.backgroundApi;
    const wallet = await engine.getWallet(walletId);
    if (!wallet) {
      return networkAccountsMap;
    }
    const networks = appSelector((s) => s.runtime.networks);

    for (const n of networks.filter(
      (item) => item.enabled && !item.isTestnet,
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
    return networkAccountsMap;
  }
}
