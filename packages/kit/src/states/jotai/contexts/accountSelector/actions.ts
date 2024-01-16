import { useRef } from 'react';

import { isEqual } from 'lodash';

import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import type useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { EModalRoutes } from '@onekeyhq/kit/src/routes/Modal/type';
import { EAccountManagerStacksRoutes } from '@onekeyhq/kit/src/views/AccountManagerStacks/router/types';
import type {
  IDBAccount,
  IDBCreateHWWalletParamsBase,
  IDBIndexedAccount,
  IDBWallet,
} from '@onekeyhq/kit-bg/src/dbs/local/types';
import type { IAccountSelectorSelectedAccount } from '@onekeyhq/kit-bg/src/dbs/simple/entity/SimpleDbEntityAccountSelector';
import { mockGetNetwork } from '@onekeyhq/kit-bg/src/mock';
import { memoFn } from '@onekeyhq/shared/src/utils/cacheUtils';
import type {
  EAccountSelectorSceneName,
  IServerNetwork,
} from '@onekeyhq/shared/types';

import { ContextJotaiActionsBase } from '../../utils/ContextJotaiActionsBase';

import {
  accountSelectorEditModeAtom,
  accountSelectorStorageReadyAtom,
  activeAccountsAtom,
  contextAtomMethod,
  defaultSelectedAccount,
  selectedAccountsAtom,
} from './atoms';

import type {
  IAccountSelectorActiveAccountInfo,
  IAccountSelectorContextData,
} from './atoms';

const { serviceAccount } = backgroundApiProxy;
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

  reloadActiveAccountInfo = contextAtomMethod(
    async (
      get,
      set,
      payload: {
        num: number;
        selectedAccount: IAccountSelectorSelectedAccount;
      },
    ): Promise<IAccountSelectorActiveAccountInfo> => {
      const { num, selectedAccount } = payload;
      const {
        othersWalletAccountId,
        indexedAccountId,
        deriveType,
        networkId,
        walletId,
      } = selectedAccount;

      let account: IDBAccount | undefined;
      let wallet: IDBWallet | undefined;
      let network: IServerNetwork | undefined;
      let indexedAccount: IDBIndexedAccount | undefined;

      if (indexedAccountId) {
        indexedAccount = await serviceAccount.getIndexedAccount({
          id: indexedAccountId,
        });
      }

      if (walletId) {
        wallet = await serviceAccount.getWallet({ walletId });
      }

      if (networkId) {
        network = await mockGetNetwork({ networkId });
        try {
          const r = await serviceAccount.getAccountOfWallet({
            indexedAccountId,
            accountId: othersWalletAccountId,
            deriveType,
            networkId,
          });
          account = r;
        } catch (e) {
          console.error(e);
        }
      }
      const activeAccount: IAccountSelectorActiveAccountInfo = {
        account,
        wallet,
        network,
        indexedAccount,
        deriveType,
      };
      set(activeAccountsAtom(), (v) => ({
        ...v,
        [num]: activeAccount,
      }));
      return activeAccount;
    },
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
      const accounts = get(selectedAccountsAtom());
      const oldSelectedAccount: IAccountSelectorSelectedAccount =
        accounts[num] || defaultSelectedAccount;
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

  showAccountSelector = contextAtomMethod(
    (
      _,
      set,
      {
        activeWallet,
        navigation,
        num,
        sceneName,
        sceneUrl,
      }: {
        activeWallet: IDBWallet | undefined;
        navigation: ReturnType<typeof useAppNavigation>;
        num: number;
      } & IAccountSelectorContextData,
    ) => {
      if (activeWallet?.id) {
        this.updateSelectedAccount.call(set, {
          num,
          builder: (v) => ({ ...v, focusedWallet: activeWallet?.id }),
        });
      }
      set(accountSelectorEditModeAtom(), false);
      navigation.pushModal(EModalRoutes.AccountManagerStacks, {
        screen: EAccountManagerStacksRoutes.AccountSelectorStack,
        params: {
          num,
          sceneName,
          sceneUrl,
        },
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
      const selectedAccountsInfo = get(selectedAccountsAtom())[0];

      // auto change to next available wallet
      if (selectedAccountsInfo?.walletId === walletId) {
        const { wallets } = await serviceAccount.getHDAndHWWallets();
        const firstWallet: IDBWallet | undefined = wallets[0];
        let firstAccount: IDBIndexedAccount | undefined;
        if (firstWallet) {
          const { accounts } = await serviceAccount.getAccountsOfWallet({
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
            focusedWallet: selectedAccountsInfo?.walletId,
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
        num,
      }: {
        sceneName: EAccountSelectorSceneName;
        sceneUrl?: string;
        num: number;
      },
    ) => {
      const selectedAccountInDB =
        await backgroundApiProxy.simpleDb.accountSelector.getSelectedAccount({
          sceneName,
          sceneUrl,
          num,
        });

      const selectedAccount = get(selectedAccountsAtom())[num];
      if (
        selectedAccountInDB &&
        !isEqual(selectedAccountInDB, selectedAccount)
      ) {
        set(selectedAccountsAtom(), (v) => ({
          ...v,
          [num]: selectedAccountInDB,
        }));
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
  const removeWallet = actions.removeWallet.use();
  const createHDWallet = actions.createHDWallet.use();
  const createHWWallet = actions.createHWWallet.use();
  const createHWHiddenWallet = actions.createHWHiddenWallet.use();
  const createHWWalletWithHidden = actions.createHWWalletWithHidden.use();

  return useRef({
    reloadActiveAccountInfo,
    refresh,
    initFromStorage,
    saveToStorage,
    updateSelectedAccount,
    showAccountSelector,
    removeWallet,
    createHDWallet,
    createHWWallet,
    createHWHiddenWallet,
    createHWWalletWithHidden,
  });
}
