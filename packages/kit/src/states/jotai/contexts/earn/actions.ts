import { useCallback, useRef } from 'react';

import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { ContextJotaiActionsBase } from '@onekeyhq/kit/src/states/jotai/utils/ContextJotaiActionsBase';
import { memoFn } from '@onekeyhq/shared/src/utils/cacheUtils';
import type {
  IAvailableAsset,
  IEarnAccountTokenResponse,
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

  getAvailableAssets = contextAtomMethod((get) => {
    const { availableAssets } = get(earnAtom());
    return availableAssets || [];
  });

  updateAvailableAssets = contextAtomMethod(
    (_, set, availableAssets: IAvailableAsset[]) => {
      this.syncToDb.call(set, {
        availableAssets,
      });
    },
  );

  getEarnAccount = contextAtomMethod((get, set, key: string) => {
    const { earnAccount } = get(earnAtom());
    return earnAccount?.[key];
  });

  updateEarnAccounts = contextAtomMethod(
    (
      get,
      set,
      {
        key,
        earnAccount,
      }: {
        key: string;
        earnAccount: IEarnAccountTokenResponse;
      },
    ) => {
      const earnData = get(earnAtom());
      this.syncToJotai.call(set, {
        earnAccount: {
          ...earnData.earnAccount,
          [key]: earnAccount,
        },
      });
    },
  );
}

const createActions = memoFn(() => new ContextJotaiActionsMarket());

export function useEarnActions() {
  const actions = createActions();
  const getAvailableAssets = actions.getAvailableAssets.use();
  const updateAvailableAssets = actions.updateAvailableAssets.use();
  const updateEarnAccounts = actions.updateEarnAccounts.use();
  const getEarnAccount = actions.getEarnAccount.use();

  const buildEarnAccountsKey = useCallback(
    (account = '', network = '') => `${account}-${network}`,
    [],
  );

  return useRef({
    getAvailableAssets,
    updateAvailableAssets,
    buildEarnAccountsKey,
    updateEarnAccounts,
    getEarnAccount,
  });
}
