import { isWalletCompatibleAllNetworks } from '@onekeyhq/engine/src/managers/wallet';
import {
  backgroundClass,
  backgroundMethod,
} from '@onekeyhq/shared/src/background/backgroundDecorators';
import { INDEX_PLACEHOLDER } from '@onekeyhq/shared/src/engine/engineConsts';

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
  getAllNetworkAccounts({
    walletId,
    accountIndex,
  }: {
    walletId: string;
    accountIndex: number;
  }) {}
}
