import { useRef } from 'react';

import { Semaphore } from 'async-mutex';
import { cloneDeep, isEqual } from 'lodash';

import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import type useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { EModalRoutes } from '@onekeyhq/kit/src/routes/Modal/type';
import { EAccountManagerStacksRoutes } from '@onekeyhq/kit/src/views/AccountManagerStacks/router/types';
import type { IChainSelectorRouteParams } from '@onekeyhq/kit/src/views/ChainSelector/router/type';
import { EChainSelectorPages } from '@onekeyhq/kit/src/views/ChainSelector/router/type';
import type {
  IDBAccount,
  IDBCreateHWWalletParamsBase,
  IDBIndexedAccount,
  IDBWallet,
} from '@onekeyhq/kit-bg/src/dbs/local/types';
import type {
  IAccountSelectorFocusedWallet,
  IAccountSelectorSelectedAccount,
} from '@onekeyhq/kit-bg/src/dbs/simple/entity/SimpleDbEntityAccountSelector';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';
import { memoFn } from '@onekeyhq/shared/src/utils/cacheUtils';
import type { EAccountSelectorSceneName } from '@onekeyhq/shared/types';

import { ContextJotaiActionsBase } from '../../utils/ContextJotaiActionsBase';

import {
  accountSelectorEditModeAtom,
  accountSelectorStorageReadyAtom,
  activeAccountsAtom,
  contextAtomMethod,
  defaultActiveAccountInfo,
  defaultSelectedAccount,
  selectedAccountsAtom,
} from './atoms';

import type {
  IAccountSelectorActiveAccountInfo,
  IAccountSelectorRouteParams,
} from './atoms';

const { serviceAccount } = backgroundApiProxy;

export type IAccountSelectorSyncFromSceneParams = {
  from: {
    sceneName: EAccountSelectorSceneName;
    sceneUrl?: string;
    sceneNum: number;
  };
  num: number;
};
class AccountSelectorActions extends ContextJotaiActionsBase {
  refresh = contextAtomMethod((_, set, payload: { num: number }) => {
    const { num } = payload;
    set(selectedAccountsAtom(), (v) => ({
      ...v,
      [num]: {
        ...v[num],
      } as any,
    }));
  });

  mutex = new Semaphore(1);

  reloadActiveAccountInfo = contextAtomMethod(
    async (
      get,
      set,
      payload: {
        num: number;
        selectedAccount: IAccountSelectorSelectedAccount;
      },
    ): Promise<IAccountSelectorActiveAccountInfo> =>
      this.mutex.runExclusive(async () => {
        const { num, selectedAccount } = payload;
        console.log('buildActiveAccountInfoFromSelectedAccount', {
          selectedAccount,
        });
        const { activeAccount } =
          await serviceAccount.buildActiveAccountInfoFromSelectedAccount({
            selectedAccount,
          });
        console.log('buildActiveAccountInfoFromSelectedAccount update state', {
          selectedAccount,
          activeAccount,
        });
        set(activeAccountsAtom(), (v) => ({
          ...v,
          [num]: activeAccount,
        }));
        return activeAccount;
      }),
  );

  updateSelectedAccount = contextAtomMethod(
    (
      get,
      set,
      payload: {
        num: number;
        builder: (
          oldAccount: IAccountSelectorSelectedAccount,
        ) => IAccountSelectorSelectedAccount;
      },
    ) => {
      const { num, builder } = payload;
      const oldSelectedAccount: IAccountSelectorSelectedAccount = cloneDeep(
        this.getSelectedAccount.call(set, { num }) || defaultSelectedAccount(),
      );
      const newSelectedAccount = builder(oldSelectedAccount);
      if (isEqual(oldSelectedAccount, newSelectedAccount)) {
        return;
      }
      set(selectedAccountsAtom(), (v) => ({
        ...v,
        [num]: newSelectedAccount,
      }));
    },
  );

  confirmAccountSelect = contextAtomMethod(
    async (
      get,
      set,
      params: {
        indexedAccount: IDBIndexedAccount | undefined;
        othersWalletAccount: IDBAccount | undefined;
        num: number;
      },
    ) => {
      const { num, othersWalletAccount, indexedAccount } = params;
      if (othersWalletAccount && indexedAccount) {
        throw new Error(
          'confirmSelectAccount ERROR: othersWalletAccount and indexedAccount can not be both defined',
        );
      }
      if (!othersWalletAccount && !indexedAccount) {
        throw new Error(
          'confirmSelectAccount ERROR: othersWalletAccount and indexedAccount can not be both undefined',
        );
      }
      const walletId = accountUtils.getWalletIdFromAccountId({
        accountId: indexedAccount?.id || othersWalletAccount?.id || '',
      });
      if (!walletId) {
        throw new Error('confirmSelectAccount ERROR: walletId is undefined');
      }

      const accountNetworkId = this.getAutoSelectNetworkIdForAccount.call(set, {
        num,
        account: othersWalletAccount,
      });

      this.updateSelectedAccount.call(set, {
        num,
        builder: (v) => ({
          ...v,
          networkId: accountNetworkId || v.networkId,
          walletId,
          othersWalletAccountId: othersWalletAccount?.id,
          indexedAccountId: indexedAccount?.id,
        }),
      });
    },
  );

  showAccountSelector = contextAtomMethod(
    (
      get,
      set,
      {
        navigation,
        num,
        sceneName,
        sceneUrl,
        linkNetwork,
      }: {
        navigation: ReturnType<typeof useAppNavigation>;
        linkNetwork?: boolean;
      } & IAccountSelectorRouteParams,
    ) => {
      const activeAccountInfo = this.getActiveAccount.call(set, { num });
      if (activeAccountInfo?.wallet?.id) {
        let focusedWalletNew: IAccountSelectorFocusedWallet =
          activeAccountInfo?.wallet?.id;
        if (accountUtils.isOthersWallet({ walletId: focusedWalletNew })) {
          focusedWalletNew = '$$others';
        }
        this.updateSelectedAccount.call(set, {
          num,
          builder: (v) => ({
            ...v,
            focusedWallet: focusedWalletNew,
          }),
        });
      }
      set(accountSelectorEditModeAtom(), false);
      navigation.pushModal(EModalRoutes.AccountManagerStacks, {
        screen: EAccountManagerStacksRoutes.AccountSelectorStack,
        params: {
          num,
          sceneName,
          sceneUrl,
          linkNetwork,
        },
      });
    },
  );

  showChainSelector = contextAtomMethod(
    (
      _,
      set,
      {
        navigation,
        ...routeParams
      }: {
        navigation: ReturnType<typeof useAppNavigation>;
      } & IChainSelectorRouteParams,
    ) => {
      navigation.pushModal(EModalRoutes.ChainSelectorModal, {
        screen: EChainSelectorPages.ChainSelector,
        params: routeParams,
      });
    },
  );

  autoSelectToCreatedWallet = contextAtomMethod(
    (
      _,
      set,
      {
        wallet,
        indexedAccount,
      }: { wallet: IDBWallet; indexedAccount: IDBIndexedAccount },
    ) => {
      this.updateSelectedAccount.call(set, {
        num: 0,
        builder: (v) => ({
          ...v,
          indexedAccountId: indexedAccount.id,
          walletId: wallet.id,
          focusedWallet: wallet.id,
        }),
      });
    },
  );

  createHDWallet = contextAtomMethod(
    async (
      _,
      set,
      {
        mnemonic,
      }: {
        mnemonic: string;
      },
    ) => {
      const { wallet, indexedAccount } = await serviceAccount.createHDWallet({
        mnemonic,
      });
      this.autoSelectToCreatedWallet.call(set, { wallet, indexedAccount });
      return { wallet, indexedAccount };
    },
  );

  createHWWallet = contextAtomMethod(
    async (_, set, params: IDBCreateHWWalletParamsBase) => {
      const res = await serviceAccount.createHWWallet(params);
      const { wallet, indexedAccount } = res;
      this.autoSelectToCreatedWallet.call(set, { wallet, indexedAccount });
      return res;
    },
  );

  createHWHiddenWallet = contextAtomMethod(
    async (_, set, { walletId }: { walletId: string }) => {
      const res = await serviceAccount.createHWHiddenWallet({ walletId });
      const { wallet, indexedAccount } = res;
      this.autoSelectToCreatedWallet.call(set, { wallet, indexedAccount });
      return res;
    },
  );

  createHWWalletWithHidden = contextAtomMethod(
    async (_, set, params: IDBCreateHWWalletParamsBase) => {
      const { wallet, device } = await this.createHWWallet.call(set, params);
      // add hidden wallet if device passphrase enabled
      if (device && device.featuresInfo?.passphrase_protection) {
        await this.createHWHiddenWallet.call(set, {
          walletId: wallet.id,
        });
      }
    },
  );

  removeWallet = contextAtomMethod(
    async (
      get,
      set,
      {
        walletId,
      }: {
        walletId: string;
      },
    ) => {
      await serviceAccount.removeWallet({ walletId });
      set(accountSelectorEditModeAtom(), false);
      const selectedAccount = this.getSelectedAccount.call(set, { num: 0 });

      // auto change to next available wallet
      if (selectedAccount?.walletId === walletId) {
        const { wallets } = await serviceAccount.getHDAndHWWallets();
        const firstWallet: IDBWallet | undefined = wallets[0];
        let firstAccount: IDBIndexedAccount | undefined;
        if (firstWallet) {
          const { accounts } = await serviceAccount.getAccountsOfWalletLegacy({
            walletId: firstWallet?.id,
          });
          // eslint-disable-next-line prefer-destructuring
          firstAccount = accounts[0];
        }

        this.updateSelectedAccount.call(set, {
          num: 0,
          builder: (v) => ({
            ...v,
            indexedAccountId: firstAccount?.id,
            walletId: firstWallet?.id,
            focusedWallet: firstWallet?.id,
          }),
        });
      } else {
        this.updateSelectedAccount.call(set, {
          num: 0,
          builder: (v) => ({
            ...v,
            focusedWallet: selectedAccount?.walletId,
          }),
        });
      }
    },
  );

  initFromStorage = contextAtomMethod(
    async (
      get,
      set,
      {
        sceneName,
        sceneUrl,
      }: {
        sceneName: EAccountSelectorSceneName;
        sceneUrl?: string;
      },
    ) => {
      const selectedAccountsMapInDB =
        await backgroundApiProxy.simpleDb.accountSelector.getSelectedAccountsMap(
          {
            sceneName,
            sceneUrl,
          },
        );

      const selectedAccountsMap = get(selectedAccountsAtom());
      if (
        selectedAccountsMapInDB &&
        !isEqual(selectedAccountsMapInDB, selectedAccountsMap)
      ) {
        set(selectedAccountsAtom(), () => selectedAccountsMapInDB);
      }
      set(accountSelectorStorageReadyAtom(), () => true);
    },
  );

  saveToStorage = contextAtomMethod(
    async (
      get,
      set,
      payload: {
        selectedAccount: IAccountSelectorSelectedAccount;
        sceneName: EAccountSelectorSceneName;
        sceneUrl?: string;
        num: number;
      },
    ) => {
      const isReady = get(accountSelectorStorageReadyAtom());
      if (isReady) {
        if (isEqual(payload.selectedAccount, defaultSelectedAccount)) {
          console.error(
            'AccountSelector.saveToStorage skip, selectedAccount is default',
          );
          return;
        }
        await backgroundApiProxy.simpleDb.accountSelector.saveSelectedAccount(
          payload,
        );
      }
    },
  );

  getSelectedAccount = contextAtomMethod(
    (
      get,
      set,
      {
        num,
      }: {
        num: number;
      },
    ) => {
      const selectedAccount = get(selectedAccountsAtom())[num];
      return selectedAccount || defaultSelectedAccount();
    },
  );

  getActiveAccount = contextAtomMethod(
    (
      get,
      set,
      {
        num,
      }: {
        num: number;
      },
    ) => {
      const activeAccount = get(activeAccountsAtom())[num];
      return activeAccount || defaultActiveAccountInfo();
    },
  );

  syncFromScene = contextAtomMethod(
    async (get, set, { from, num }: IAccountSelectorSyncFromSceneParams) => {
      const { sceneName, sceneUrl, sceneNum } = from;

      const selectedAccount =
        await backgroundApiProxy.simpleDb.accountSelector.getSelectedAccount({
          sceneName,
          sceneUrl,
          num: sceneNum,
        });

      this.updateSelectedAccount.call(set, {
        num,
        builder: (v) => selectedAccount || v,
      });
    },
  );

  getAutoSelectNetworkIdForAccount = contextAtomMethod(
    (
      get,
      set,
      {
        num,
        account,
      }: {
        num: number;
        account: IDBAccount | undefined;
      },
    ) => {
      if (!account) {
        return '';
      }
      const { networkId } = this.getSelectedAccount.call(set, { num });
      if (!networkId) {
        return '';
      }
      const accountNetworkId = accountUtils.getAccountCompatibleNetwork({
        account,
        networkId,
      });
      if (accountNetworkId && accountNetworkId !== networkId) {
        return accountNetworkId;
      }
      return '';
    },
  );

  autoSelectNetworkOfOthersWalletAccount = contextAtomMethod(
    async (
      get,
      set,
      {
        num,
        othersWalletAccountId,
      }: {
        num: number;
        othersWalletAccountId: string | undefined;
      },
    ) => {
      if (!othersWalletAccountId) {
        return;
      }
      const account = await serviceAccount.getDBAccount({
        accountId: othersWalletAccountId,
      });
      if (!account) {
        return;
      }
      const accountNetworkId = this.getAutoSelectNetworkIdForAccount.call(set, {
        num,
        account,
      });
      if (accountNetworkId) {
        this.updateSelectedAccount.call(set, {
          num,
          builder: (v) => ({
            ...v,
            networkId: accountNetworkId,
          }),
        });
      }
    },
  );

  autoSelectAccount = contextAtomMethod(
    async (get, set, { num }: { num: number }) => {
      const storageReady = get(accountSelectorStorageReadyAtom());
      const selectedAccount = this.getSelectedAccount.call(set, { num });
      const activeAccount = this.getActiveAccount.call(set, { num });
      // TODO auto select account from home scene
      if (activeAccount && activeAccount?.ready && storageReady) {
        const { network, wallet, indexedAccount, account } = activeAccount;
        if (
          !selectedAccount?.focusedWallet ||
          !network ||
          !wallet ||
          (!indexedAccount && !account)
        ) {
          const selectedAccountNew = cloneDeep(
            selectedAccount || defaultSelectedAccount(),
          );
          let selectedWalletId = wallet?.id;
          let selectedWallet = wallet;
          let selectedIndexedAccountId = indexedAccount?.id;
          const hasIndexedAccounts =
            selectedWalletId &&
            (accountUtils.isHdWallet({
              walletId: selectedWalletId,
            }) ||
              accountUtils.isHwWallet({
                walletId: selectedWalletId,
              })) &&
            (await serviceAccount.isWalletHasIndexedAccounts({
              walletId: selectedWalletId,
            }));
          if (!selectedWalletId || !hasIndexedAccounts) {
            const { wallets } = await serviceAccount.getHDAndHWWallets();
            for (const wallet0 of wallets) {
              if (
                await serviceAccount.isWalletHasIndexedAccounts({
                  walletId: wallet0.id,
                })
              ) {
                selectedWallet = wallet0;
                selectedWalletId = selectedWallet?.id;
                selectedAccountNew.walletId = selectedWalletId;
                break;
              }
            }
          }

          const isHdWallet = accountUtils.isHdWallet({
            walletId: selectedWalletId,
          });
          const isHwWallet = accountUtils.isHwWallet({
            walletId: selectedWalletId,
          });
          const isOthers = !isHdWallet && !isHwWallet;

          if (isOthers) {
            selectedAccountNew.focusedWallet = '$$others';
            selectedAccountNew.indexedAccountId = undefined;
            // TODO auto select first others account if wallet or account not match
          } else if (selectedWalletId) {
            if (
              !indexedAccount ||
              indexedAccount.walletId !== selectedWalletId
            ) {
              selectedAccountNew.focusedWallet = selectedWalletId;
              const { accounts: indexedAccounts } =
                await serviceAccount.getIndexedAccounts({
                  walletId: selectedWalletId,
                });
              selectedIndexedAccountId = indexedAccounts[0]?.id;
              selectedAccountNew.indexedAccountId = selectedIndexedAccountId;
            }
          }

          // TODO auto select network and derive type, check network compatible for others account

          this.updateSelectedAccount.call(set, {
            num,
            builder: () => selectedAccountNew,
          });
        }
      }
    },
  );
}

const createActions = memoFn(() => new AccountSelectorActions());

export function useAccountSelectorActions() {
  const actions = createActions();
  const reloadActiveAccountInfo = actions.reloadActiveAccountInfo.use();
  const initFromStorage = actions.initFromStorage.use();
  const saveToStorage = actions.saveToStorage.use();
  const updateSelectedAccount = actions.updateSelectedAccount.use();
  const refresh = actions.refresh.use();
  const showAccountSelector = actions.showAccountSelector.use();
  const showChainSelector = actions.showChainSelector.use();
  const removeWallet = actions.removeWallet.use();
  const createHDWallet = actions.createHDWallet.use();
  const createHWWallet = actions.createHWWallet.use();
  const createHWHiddenWallet = actions.createHWHiddenWallet.use();
  const createHWWalletWithHidden = actions.createHWWalletWithHidden.use();
  const autoSelectAccount = actions.autoSelectAccount.use();
  const autoSelectNetworkOfOthersWalletAccount =
    actions.autoSelectNetworkOfOthersWalletAccount.use();
  const syncFromScene = actions.syncFromScene.use();
  const confirmAccountSelect = actions.confirmAccountSelect.use();

  return useRef({
    reloadActiveAccountInfo,
    refresh,
    initFromStorage,
    saveToStorage,
    updateSelectedAccount,
    showAccountSelector,
    showChainSelector,
    removeWallet,
    createHDWallet,
    createHWWallet,
    createHWHiddenWallet,
    createHWWalletWithHidden,
    autoSelectAccount,
    autoSelectNetworkOfOthersWalletAccount,
    syncFromScene,
    confirmAccountSelect,
  });
}
