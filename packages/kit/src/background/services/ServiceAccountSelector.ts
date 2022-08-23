/* eslint-disable @typescript-eslint/require-await */
import { debounce } from 'lodash';

import { isAccountCompatibleWithNetwork } from '@onekeyhq/engine/src/managers/account';
import { INetwork, IWallet } from '@onekeyhq/engine/src/types';

import { AllNetwork } from '../../components/Header/AccountSelectorChildren/RightChainSelector';
import { getActiveWalletAccount } from '../../hooks/redux';
import { getManageNetworks } from '../../hooks/useManageNetworks';
import reducerAccountSelector from '../../store/reducers/reducerAccountSelector';
import { wait } from '../../utils/helper';
import { backgroundClass, backgroundMethod, bindThis } from '../decorators';

import ServiceBase from './ServiceBase';

import type { AccountGroup } from '../../components/Header/AccountSelectorChildren/RightAccountSection/ItemSection';

@backgroundClass()
export default class ServiceAccountSelector extends ServiceBase {
  @bindThis()
  @backgroundMethod()
  async setSelectedWallet(wallet: IWallet | null) {
    const { dispatch } = this.backgroundApi;
    dispatch(reducerAccountSelector.actions.updateSelectedWallet(wallet));
  }

  @bindThis()
  @backgroundMethod()
  async setSelectedNetwork(network: INetwork | null) {
    const { dispatch } = this.backgroundApi;
    dispatch(reducerAccountSelector.actions.updateSelectedNetwork(network));
  }

  @bindThis()
  @backgroundMethod()
  async setRightChainSelectorNetworkId(id: string | typeof AllNetwork) {
    if (id === AllNetwork || !id) {
      await this.setSelectedNetwork(null);
      return;
    }
    const { enabledNetworks } = getManageNetworks();
    const network = enabledNetworks.find((item) => item.id === id);
    await this.setSelectedNetwork(network ?? null);
  }

  async getAccountsByGroup() {
    const { appSelector, engine, dispatch } = this.backgroundApi;

    console.log('calling getAccountsByGroup');
    let groupData: AccountGroup[] = [];
    const { enabledNetworks } = getManageNetworks();
    const { selectedNetwork, selectedWallet, isSelectorOpen, accountsInGroup } =
      appSelector((s) => s.accountSelector);
    if (!isSelectorOpen) {
      // return accountsInGroup;
      return groupData;
    }
    if (!selectedWallet) {
      return groupData;
    }
    const selectedNetworkId = selectedNetwork?.id;
    const walletAccounts = selectedWallet?.accounts || [];
    const accountsIdInSelected = walletAccounts.filter((accountId) =>
      selectedNetworkId
        ? isAccountCompatibleWithNetwork(accountId, selectedNetworkId)
        : true,
    );

    console.log('getAccountsByGroup calling', selectedNetwork);
    const accountsList = await engine.getAccounts(accountsIdInSelected);
    if (selectedNetwork) {
      if (accountsList && accountsList.length)
        groupData = [
          {
            // TODO use network id
            title: selectedNetwork,
            // TODO use account id
            data: accountsList,
          },
        ];
    } else {
      enabledNetworks.forEach((network) => {
        const data = accountsList.filter((account) =>
          isAccountCompatibleWithNetwork(account.id, network.id),
        );
        if (data && data.length) {
          groupData.push({
            // TODO use network id
            title: network,
            // TODO use account id
            data,
          });
        }
      });
    }

    // await wait(600);
    return groupData;
  }

  _reloadAccountsByGroup = debounce(
    async () => {
      const { appSelector, engine, dispatch } = this.backgroundApi;
      try {
        const {
          selectedNetwork,
          selectedWallet,
          isSelectorOpen,
          accountsInGroup,
        } = appSelector((s) => s.accountSelector);
        if (!isSelectorOpen) {
          return;
        }

        dispatch(
          reducerAccountSelector.actions.updateAccountsInGroupLoading(true),
        );

        const data = await this.getAccountsByGroup();

        await wait(300);

        dispatch(
          reducerAccountSelector.actions.updateAccountsInGroup({
            walletId: selectedWallet?.id,
            networkId: selectedNetwork?.id,
            payload: data,
          }),
        );
      } finally {
        dispatch(
          reducerAccountSelector.actions.updateAccountsInGroupLoading(false),
        );
      }
    },
    100,
    {
      leading: false,
      trailing: true,
    },
  );

  @bindThis()
  @backgroundMethod()
  async reloadAccountsByGroup() {
    this._reloadAccountsByGroup();
  }

  @bindThis()
  @backgroundMethod()
  async setSelectedWalletByActive() {
    const { network, wallet } = getActiveWalletAccount();
    await this.setSelectedNetwork(network);
    await this.setSelectedWallet(wallet);
  }
}
