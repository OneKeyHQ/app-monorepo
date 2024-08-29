import { useRef } from 'react';

import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { ContextJotaiActionsBase } from '@onekeyhq/kit/src/states/jotai/utils/ContextJotaiActionsBase';
import { memoFn } from '@onekeyhq/shared/src/utils/cacheUtils';
import type {
  IAvailableAsset,
  IEarnAccount,
  IEarnAtomData,
} from '@onekeyhq/shared/types/staking';

import { contextAtomMethod, earnAtom } from './atoms';

export const homeResettingFlags: Record<string, number> = {};

class ContextJotaiActionsMarket extends ContextJotaiActionsBase {
  syncToDb = contextAtomMethod(async (get, set, payload: IEarnAtomData) => {
    const atom = earnAtom();
    if (!get(atom).isMounted) {
      return;
    }
    this.syncToJotai.call(set, payload);
    await backgroundApiProxy.simpleDb.earn.setRawData(payload);
  });

  syncToJotai = contextAtomMethod((get, set, payload: IEarnAtomData) => {
    const atom = earnAtom();
    if (!get(atom).isMounted) {
      return;
    }
    set(atom, (prev: IEarnAtomData) => ({
      ...prev,
      ...payload,
    }));
  });

  updateAvailableAssets = contextAtomMethod(
    async (_, set, availableAssets: IAvailableAsset[]) => {
      await this.syncToDb.call(set, {
        availableAssets,
      });
    },
  );

  updateEarnAccounts = contextAtomMethod((_, set, accounts: IEarnAccount[]) => {
    this.syncToJotai.call(set, {
      accounts,
    });
  });

  clearEarnAccounts = contextAtomMethod((_, set) => {
    this.syncToJotai.call(set, {
      accounts: [],
    });
  });

  addEarnAccount = contextAtomMethod(
    async (get, set, earnAccount: IEarnAccount) => {
      const atom = earnAtom();
      const { accounts } = get(atom);
      const earnAccounts =
        accounts?.filter(
          (account) => account.accountAddress !== earnAccount.accountAddress,
        ) || [];
      earnAccounts.push(earnAccount);
      this.updateEarnAccounts.call(set, earnAccounts);
    },
  );
}

const createActions = memoFn(() => new ContextJotaiActionsMarket());

export function useEarnActions() {
  const actions = createActions();
  const updateAvailableAssets = actions.updateAvailableAssets.use();
  const updateEarnAccounts = actions.updateEarnAccounts.use();
  const addEarnAccount = actions.addEarnAccount.use();
  const clearEarnAccounts = actions.clearEarnAccounts.use();

  return useRef({
    addEarnAccount,
    updateAvailableAssets,
    updateEarnAccounts,
    clearEarnAccounts,
  });
}
