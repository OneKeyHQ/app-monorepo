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
  syncToDb = contextAtomMethod((get, set, payload: IEarnAtomData) => {
    const atom = earnAtom();
    if (!get(atom).isMounted) {
      return;
    }
    void this.syncToJotai.call(set, payload);
    void backgroundApiProxy.simpleDb.earn.setRawData(payload);
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
    (_, set, availableAssets: IAvailableAsset[]) => {
      this.syncToDb.call(set, {
        availableAssets,
      });
    },
  );

  updateEarnAccounts = contextAtomMethod((_, set, accounts: IEarnAccount[]) => {
    this.syncToJotai.call(set, {
      accounts,
    });
  });
}

const createActions = memoFn(() => new ContextJotaiActionsMarket());

export function useEarnActions() {
  const actions = createActions();
  const updateAvailableAssets = actions.updateAvailableAssets.use();
  const updateEarnAccounts = actions.updateEarnAccounts.use();

  return useRef({
    updateAvailableAssets,
    updateEarnAccounts,
  });
}
