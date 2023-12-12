import { useRef } from 'react';

import { isEqual } from 'lodash';

import type {
  IDBAccount,
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

import backgroundApiProxy from '../../../../background/instance/backgroundApiProxy';
import { ContextJotaiActionsBase } from '../../utils/ContextJotaiActionsBase';

import {
  accountSelectorStorageReadyAtom,
  activeAccountsAtom,
  contextAtomMethod,
  defaultSelectedAccount,
  selectedAccountsAtom,
} from './atoms';

import type { IAccountSelectorActiveAccountInfo } from './atoms';

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
      const { serviceAccount } = backgroundApiProxy;
      const { accountId, indexedAccountId, deriveType, networkId, walletId } =
        selectedAccount;

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
            accountId,
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

      set(selectedAccountsAtom(), (v) => ({
        ...v,
        [num]: builder(oldSelectedAccount),
      }));
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
  // ----------------------------------------------
  // const r = useMemo(() => {
  //   const actions = createActions();
  //   const reloadActiveAccountInfo = actions.reloadActiveAccountInfo.use();
  //   const initFromStorage = actions.initFromStorage.use();
  //   const saveToStorage = actions.saveToStorage.use();
  //   const updateSelectedAccount = actions.updateSelectedAccount.use();
  //   const refresh = actions.refresh.use();

  //   return {
  //     reloadActiveAccountInfo,
  //     refresh,
  //     initFromStorage,
  //     saveToStorage,
  //     updateSelectedAccount,
  //   };
  // }, []);
  // return r;

  // ----------------------------------------------
  // const actions = createActions();
  // const reloadActiveAccountInfo = actions.reloadActiveAccountInfo.use();
  // const initFromStorage = actions.initFromStorage.use();
  // const saveToStorage = actions.saveToStorage.use();
  // const updateSelectedAccount = actions.updateSelectedAccount.use();
  // const refresh = actions.refresh.use();

  // return {
  //   reloadActiveAccountInfo,
  //   refresh,
  //   initFromStorage,
  //   saveToStorage,
  //   updateSelectedAccount,
  // };

  // ----------------------------------------------
  const actions = createActions();
  const reloadActiveAccountInfo = actions.reloadActiveAccountInfo.use();
  const initFromStorage = actions.initFromStorage.use();
  const saveToStorage = actions.saveToStorage.use();
  const updateSelectedAccount = actions.updateSelectedAccount.use();
  const refresh = actions.refresh.use();

  return useRef({
    reloadActiveAccountInfo,
    refresh,
    initFromStorage,
    saveToStorage,
    updateSelectedAccount,
  });
}
