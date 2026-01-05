import { useRef } from 'react';

import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { memoFn } from '@onekeyhq/shared/src/utils/cacheUtils';

import { ContextJotaiActionsBase } from '../../utils/ContextJotaiActionsBase';

import { contextAtomMethod, tokenListAtom, tokenListMapAtom } from './atoms';
import type { IToken } from '@onekeyhq/shared/types/token';

class ContextJotaiActionsHistoryList extends ContextJotaiActionsBase {
  updateTokenList = contextAtomMethod(
    (get, set, value: Record<string, IToken[]>) => {
      set(tokenListAtom(), value);
    },
  );

  updateTokenListMap = contextAtomMethod(
    (get, set, value: { data: Record<string, IToken>; merge?: boolean }) => {
      set(tokenListMapAtom(), value.data);
    },
  );
}

const createActions = memoFn(() => {
  console.log('new ContextJotaiActionsHistoryList()', Date.now());
  return new ContextJotaiActionsHistoryList();
});

export function useHistoryListActions() {
  const actions = createActions();

  const updateTokenList = actions.updateTokenList.use();
  const updateTokenListMap = actions.updateTokenListMap.use();

  return useRef({
    updateTokenList,
    updateTokenListMap,
  });
}
