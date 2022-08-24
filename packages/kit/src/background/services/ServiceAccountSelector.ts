/* eslint-disable @typescript-eslint/require-await */
import { debounce } from 'lodash';

import { isAccountCompatibleWithNetwork } from '@onekeyhq/engine/src/managers/account';
import { INetwork, IWallet } from '@onekeyhq/engine/src/types';
import debugLogger from '@onekeyhq/shared/src/logger/debugLogger';

import { ACCOUNT_SELECTOR_REFRESH_DEBOUNCE } from '../../components/Header/AccountSelectorChildren/accountSelectorConsts';
import { AllNetwork } from '../../components/Header/AccountSelectorChildren/RightChainSelector';
import { getActiveWalletAccount } from '../../hooks/redux';
import { getManageNetworks } from '../../hooks/useManageNetworks';
import reducerAccountSelector from '../../store/reducers/reducerAccountSelector';
import { wait } from '../../utils/helper';
import { backgroundClass, backgroundMethod, bindThis } from '../decorators';

import ServiceBase from './ServiceBase';

import type { AccountGroup } from '../../components/Header/AccountSelectorChildren/RightAccountSection/ItemSection';

const {
  updateSelectedWalletId,
  updateSelectedNetworkId,
  updateAccountsGroup,
  updateIsLoading,
  updatePreloadingCreateAccount,
} = reducerAccountSelector.actions;

@backgroundClass()
export default class ServiceAccountSelector extends ServiceBase {
  @bindThis()
  @backgroundMethod()
  async setSelectedWalletToActive() {
    const { network, wallet } = getActiveWalletAccount();
    await this.updateSelectedNetwork(network?.id);
    await this.updateSelectedWallet(wallet?.id);
  }

  @bindThis()
  @backgroundMethod()
  async updateSelectedWallet(walletId?: string) {
    const { dispatch } = this.backgroundApi;

    // TODO ignore update if create new account loading
    dispatch(updateSelectedWalletId(walletId || undefined));
  }

  @bindThis()
  @backgroundMethod()
  async updateSelectedNetwork(networkId?: string) {
    const { dispatch } = this.backgroundApi;

    dispatch(updateSelectedNetworkId(networkId || undefined));
  }

  @bindThis()
  @backgroundMethod()
  async setRightChainSelectorNetworkId(id: string | typeof AllNetwork) {
    if (id === AllNetwork || !id) {
      await this.updateSelectedNetwork(undefined);
      return;
    }
    await this.updateSelectedNetwork(id);
  }

  async getAccountsByGroup() {
    const { appSelector, engine } = this.backgroundApi;

    debugLogger.accountSelector.info('calling getAccountsByGroup');
    let groupData: AccountGroup[] = [];
    const { networkId, walletId, isOpenDelay } = appSelector(
      (s) => s.accountSelector,
    );
    if (!isOpenDelay) {
      // return accountsInGroup;
      return groupData;
    }
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
      const { dispatch } = this.backgroundApi;
      try {
        dispatch(updateIsLoading(true));

        let data: AccountGroup[] = [];
        try {
          data = await this.getAccountsByGroup();
        } catch (error) {
          debugLogger.accountSelector.error(error);
        }

        dispatch(updateAccountsGroup(data));
      } finally {
        dispatch(updateIsLoading(false));
      }
    },
    ACCOUNT_SELECTOR_REFRESH_DEBOUNCE,
    {
      leading: false,
      trailing: true,
    },
  );

  @bindThis()
  @backgroundMethod()
  async refreshAccountsGroup({ delay = 0 }: { delay?: number } = {}) {
    const { dispatch, appSelector } = this.backgroundApi;
    const { isOpenDelay } = appSelector((s) => s.accountSelector);
    if (!isOpenDelay) {
      return;
    }
    dispatch(updateIsLoading(true));
    await wait(delay);
    this._refreshAccountsGroup();
  }

  @bindThis()
  @backgroundMethod()
  async preloadingCreateAccount(info: { networkId: string; walletId: string }) {
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
    delay = 600,
  }: {
    networkId?: string;
    walletId?: string;
    accountId?: string;
    delay?: number;
  } = {}) {
    const { dispatch } = this.backgroundApi;

    if (walletId) await this.updateSelectedWallet(walletId);
    if (networkId) await this.updateSelectedNetwork(networkId);

    if (delay > 0) {
      dispatch(
        updatePreloadingCreateAccount({ networkId, walletId, accountId }),
      );
    }
    await wait(delay);
    dispatch(updatePreloadingCreateAccount(undefined));
  }
}
