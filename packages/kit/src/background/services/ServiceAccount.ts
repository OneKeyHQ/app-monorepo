import { Wallet } from '@onekeyhq/engine/src/types/wallet';
import {
  updateAccountDetail,
  updateAccounts,
  updateWallet,
  updateWallets,
} from '@onekeyhq/kit/src/store/reducers/runtime';

import { changeActiveAccount } from '../../store/reducers/general';
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
    walletId: string;
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
      const account = await engine.getAccount(
        wallet.accounts[0],
        activeNetworkId,
      );
      accountId = account?.id ?? null;
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
}

export default ServiceAccount;
