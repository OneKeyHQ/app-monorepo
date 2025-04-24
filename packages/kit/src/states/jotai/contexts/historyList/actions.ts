import { useRef } from 'react';

import { memoFn } from '@onekeyhq/shared/src/utils/cacheUtils';
import type { IAddressBadge } from '@onekeyhq/shared/types/address';

import { ContextJotaiActionsBase } from '../../utils/ContextJotaiActionsBase';

import { addressMapAtom, contextAtomMethod, searchKeyAtom } from './atoms';

class ContextJotaiActionsHistoryList extends ContextJotaiActionsBase {
  updateSearchKey = contextAtomMethod((get, set, value: string) => {
    set(searchKeyAtom(), value);
  });

  updateAddressMap = contextAtomMethod(
    (get, set, value: Record<string, IAddressBadge>) => {
      const addressMap = get(addressMapAtom());
      set(addressMapAtom(), { ...addressMap, ...value });
    },
  );
}

const createActions = memoFn(() => {
  console.log('new ContextJotaiActionsHistoryList()', Date.now());
  return new ContextJotaiActionsHistoryList();
});

export function useHistoryListActions() {
  const actions = createActions();

  const updateSearchKey = actions.updateSearchKey.use();
  const updateAddressMap = actions.updateAddressMap.use();

  return useRef({
    updateSearchKey,
    updateAddressMap,
  });
}
