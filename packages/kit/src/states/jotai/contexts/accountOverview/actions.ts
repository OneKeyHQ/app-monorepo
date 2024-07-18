import { useRef } from 'react';

import { memoFn } from '@onekeyhq/shared/src/utils/cacheUtils';

import { ContextJotaiActionsBase } from '../../utils/ContextJotaiActionsBase';

import { accountWorthAtom, contextAtomMethod } from './atoms';

class ContextJotaiActionsAccountOverview extends ContextJotaiActionsBase {
  updateAccountWorth = contextAtomMethod(
    (
      get,
      set,
      payload: {
        worth: string;
      },
    ) => {
      set(accountWorthAtom(), { worth: payload.worth });
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

  return useRef({
    updateAccountWorth,
  });
}
