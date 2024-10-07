import { useRef } from 'react';

import BigNumber from 'bignumber.js';

import { memoFn } from '@onekeyhq/shared/src/utils/cacheUtils';

import { ContextJotaiActionsBase } from '../../utils/ContextJotaiActionsBase';

import {
  accountOverviewStateAtom,
  accountWorthAtom,
  contextAtomMethod,
} from './atoms';

class ContextJotaiActionsAccountOverview extends ContextJotaiActionsBase {
  updateAccountOverviewState = contextAtomMethod(
    (get, set, payload: { initialized?: boolean; isRefreshing?: boolean }) => {
      set(accountOverviewStateAtom(), {
        ...get(accountOverviewStateAtom()),
        ...payload,
      });
    },
  );

  updateAccountWorth = contextAtomMethod(
    (
      get,
      set,
      payload: {
        worth: Record<string, string>;
        createAtNetworkWorth?: string;
        initialized: boolean;
        accountId: string;
        updateAll?: boolean;
        merge?: boolean;
      },
    ) => {
      if (payload.merge) {
        const { worth, createAtNetworkWorth } = get(accountWorthAtom());
        set(accountWorthAtom(), {
          worth: {
            ...worth,
            ...payload.worth,
          },
          createAtNetworkWorth: new BigNumber(createAtNetworkWorth ?? '0')
            .plus(payload.createAtNetworkWorth ?? '0')
            .toFixed(),
          initialized: payload.initialized,
          accountId: payload.accountId,
          updateAll: payload.updateAll,
        });
        return;
      }

      set(accountWorthAtom(), {
        worth: payload.worth,
        createAtNetworkWorth: payload.createAtNetworkWorth ?? '0',
        initialized: payload.initialized,
        accountId: payload.accountId,
        updateAll: payload.updateAll,
      });
    },
  );
}

const createActions = memoFn(() => {
  console.log('new ContextJotaiActionsAccountOverview()', Date.now());
  return new ContextJotaiActionsAccountOverview();
});

export function useAccountOverviewActions() {
  const actions = createActions();

  const updateAccountWorth = actions.updateAccountWorth.use();
  const updateAccountOverviewState = actions.updateAccountOverviewState.use();

  return useRef({
    updateAccountWorth,
    updateAccountOverviewState,
  });
}
