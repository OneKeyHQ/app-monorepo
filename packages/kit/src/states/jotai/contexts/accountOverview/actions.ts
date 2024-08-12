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
        worth: string;
        initialized: boolean;
        accountId: string;
        merge?: boolean;
      },
    ) => {
      if (payload.merge) {
        const { worth } = get(accountWorthAtom());
        set(accountWorthAtom(), {
          worth: new BigNumber(worth ?? '0')
            .plus(payload.worth ?? '0')
            .toFixed(),
          initialized: payload.initialized,
          accountId: payload.accountId,
        });
        return;
      }

      set(accountWorthAtom(), {
        worth: payload.worth,
        initialized: payload.initialized,
        accountId: payload.accountId,
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
