import { useRef } from 'react';

import { memoFn } from '@onekeyhq/shared/src/utils/cacheUtils';

import { ContextJotaiActionsBase } from '../../utils/ContextJotaiActionsBase';

import { contextAtomMethod, searchKeyAtom } from './atoms';

class ContextJotaiActionsNFTList extends ContextJotaiActionsBase {
  updateSearchKey = contextAtomMethod((get, set, value: string) => {
    set(searchKeyAtom(), value);
  });
}

const createActions = memoFn(() => {
  console.log('new ContextJotaiActionsNFTList()', Date.now());
  return new ContextJotaiActionsNFTList();
});

export function useNFTListActions() {
  const actions = createActions();

  const updateSearchKey = actions.updateSearchKey.use();

  return useRef({
    updateSearchKey,
  });
}
