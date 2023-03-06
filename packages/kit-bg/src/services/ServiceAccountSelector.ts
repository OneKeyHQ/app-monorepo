/* eslint-disable @typescript-eslint/require-await */
import { debounce } from 'lodash';

import { isAccountCompatibleWithNetwork } from '@onekeyhq/engine/src/managers/account';
import type { INetwork, IWallet } from '@onekeyhq/engine/src/types';
import { ACCOUNT_SELECTOR_REFRESH_DEBOUNCE } from '@onekeyhq/kit/src/components/Header/AccountSelectorChildren/accountSelectorConsts';
import type { AccountGroup } from '@onekeyhq/kit/src/components/Header/AccountSelectorChildren/RightAccountSection/ItemSection';
import { getActiveWalletAccount } from '@onekeyhq/kit/src/hooks/redux';
import { getManageNetworks } from '@onekeyhq/kit/src/hooks/useManageNetworks';
import reducerAccountSelector from '@onekeyhq/kit/src/store/reducers/reducerAccountSelector';
import { wait } from '@onekeyhq/kit/src/utils/helper';
import {
  backgroundClass,
  backgroundMethod,
  bindThis,
} from '@onekeyhq/shared/src/background/backgroundDecorators';
import debugLogger from '@onekeyhq/shared/src/logger/debugLogger';

import ServiceBase from './ServiceBase';

const {
  updateSelectedWalletId,
  updateSelectedNetworkId,
  updatePreloadingCreateAccount,
} = reducerAccountSelector.actions;

@backgroundClass()
export default class ServiceAccountSelector extends ServiceBase {
  @bindThis()
  @backgroundMethod()
  async setSelectedWalletToActive() {
    const { network, wallet } = getActiveWalletAccount();
    debugLogger.accountSelector.info(
      'ServiceAccountSelector.setSelectedWalletToActive >>>> ',
      wallet?.id,
    );
    return this.updateSelectedWalletAndNetwork({
      walletId: wallet?.id,
      networkId: network?.id,
    });
  }

  @bindThis()
  @backgroundMethod()
  async updateSelectedWalletAndNetwork({
    walletId,
    networkId,
  }: {
    walletId?: string;
    networkId?: string;
  }) {
    const { dispatch } = this.backgroundApi;
    const actions = [];
    if (walletId) {
      actions.push(updateSelectedWalletId(walletId || undefined));
    }
    if (networkId) {
      actions.push(updateSelectedNetworkId(networkId || undefined));
    }
    if (actions.length) {
      dispatch(...actions);
    }
  }

  @bindThis()
  @backgroundMethod()
  async updateSelectedWallet(walletId?: string) {
    debugLogger.accountSelector.info(
      'ServiceAccountSelector.updateSelectedWallet >>>> ',
      walletId,
    );
    // TODO ignore update if create new account loading
    return this.updateSelectedWalletAndNetwork({
      walletId,
    });
  }

  @bindThis()
  @backgroundMethod()
  async updateSelectedNetwork(networkId?: string) {
    return this.updateSelectedWalletAndNetwork({
      networkId,
    });
  }

  async getAccountsByGroup() {
    const { appSelector, engine } = this.backgroundApi;

    debugLogger.accountSelector.info('calling getAccountsByGroup');
    let groupData: AccountGroup[] = [];
    const { networkId, walletId } = appSelector((s) => s.accountSelector);
    if (!walletId) {
      return groupData;
    }
    const selectedNetworkId = networkId;
    const selectedWalletId = walletId;
    let network: INetwork | null = null;
    let wallet: IWallet | null = null;
    if (selectedNetworkId) {
      network = await engine.getNetwork(selectedNetworkId);
    }
    if (selectedWalletId) {
      wallet = await engine.getWallet(selectedWalletId);
    }
    const walletAccounts = wallet?.accounts || [];
    const accountsIdInSelected = walletAccounts.filter((accountId) =>
      selectedNetworkId
        ? isAccountCompatibleWithNetwork(accountId, selectedNetworkId)
        : true,
    );
    const accountsList = await engine.getAccounts(accountsIdInSelected);

    if (network) {
      if (accountsList && accountsList.length)
        groupData = [
          {
            // TODO use network id
            title: network,
            // TODO use account id
            data: accountsList,
          },
        ];
    } else {
      const { enabledNetworks } = getManageNetworks();
      enabledNetworks.forEach((networkItem) => {
        const data = accountsList.filter((account) =>
          isAccountCompatibleWithNetwork(account.id, networkItem.id),
        );
        if (data && data.length) {
          groupData.push({
            // TODO use network id
            title: networkItem,
            // TODO use account id
            data,
          });
        }
      });
    }

    return groupData;
  }

  _refreshAccountsGroup = debounce(
    async () => {
      // noop
    },
    ACCOUNT_SELECTOR_REFRESH_DEBOUNCE,
    {
      leading: false,
      trailing: true,
    },
  );

  @bindThis()
  @backgroundMethod()
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async refreshAccountsGroup({ delay = 0 }: { delay?: number } = {}) {
    // noop
  }

  @bindThis()
  @backgroundMethod()
  async preloadingCreateAccount(info: {
    networkId: string;
    walletId: string;
    template?: string;
  }) {
    const { dispatch } = this.backgroundApi;

    const { networkId, walletId } = info;

    await this.updateSelectedWallet(walletId);
    await this.updateSelectedNetwork(networkId);

    dispatch(updatePreloadingCreateAccount(info));
  }

  @bindThis()
  @backgroundMethod()
  async preloadingCreateAccountDone({
    networkId,
    walletId,
    accountId,
    template,
    delay = 600,
  }: {
    networkId?: string;
    walletId?: string;
    accountId?: string;
    template?: string;
    delay?: number;
  } = {}) {
    const { dispatch } = this.backgroundApi;

    if (walletId) await this.updateSelectedWallet(walletId);
    if (networkId) await this.updateSelectedNetwork(networkId);

    if (delay > 0) {
      dispatch(
        updatePreloadingCreateAccount({
          networkId,
          walletId,
          accountId,
          template,
        }),
      );
    }
    await wait(delay);
    dispatch(updatePreloadingCreateAccount(undefined));
  }
}
