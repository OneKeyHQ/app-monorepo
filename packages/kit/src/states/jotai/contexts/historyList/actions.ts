import { useRef } from 'react';

import { memoFn } from '@onekeyhq/shared/src/utils/cacheUtils';

import { ContextJotaiActionsBase } from '../../utils/ContextJotaiActionsBase';

import { contextAtomMethod, searchKeyAtom } from './atoms';

class ContextJotaiActionsHistoryList extends ContextJotaiActionsBase {
  updateSearchKey = contextAtomMethod((get, set, value: string) => {
    set(searchKeyAtom(), value);
  });
}

const createActions = memoFn(() => {
  console.log('new ContextJotaiActionsHistoryList()', Date.now());
  return new ContextJotaiActionsHistoryList();
});

export function useHistoryListActions() {
  const actions = createActions();

  const updateSearchKey = actions.updateSearchKey.use();

  return useRef({
    updateSearchKey,
  });
}
