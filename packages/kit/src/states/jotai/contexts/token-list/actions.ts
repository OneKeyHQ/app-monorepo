import { useRef } from 'react';

import { isEqual } from 'lodash';

import { memoFn } from '@onekeyhq/shared/src/utils/cacheUtils';
import type { IAccountToken, ITokenFiat } from '@onekeyhq/shared/types/token';

import { ContextJotaiActionsBase } from '../../utils/ContextJotaiActionsBase';

import { contextAtomMethod, tokenListAtom, tokenListMapAtom } from './atoms';

class ContextJotaiActionsTokenList extends ContextJotaiActionsBase {
  refreshTokenList = contextAtomMethod(
    (
      get,
      set,
      tokenList: {
        tokens: IAccountToken[];
        keys: string;
      },
    ) => {
      if (!isEqual(get(tokenListAtom()), tokenList.keys)) {
        set(tokenListAtom(), tokenList);
      }
    },
  );

  refreshTokenListMap = contextAtomMethod(
    (
      get,
      set,
      tokenListMap: {
        [key: string]: ITokenFiat;
      },
    ) => {
      set(tokenListMapAtom(), tokenListMap);
    },
  );
}

const createActions = memoFn(() => {
  console.log('new ContextJotaiActionsTokenList()', Date.now());
  return new ContextJotaiActionsTokenList();
});

export function useTokenListActions() {
  const actions = createActions();
  const refreshTokenList = actions.refreshTokenList.use();
  const refreshTokenListMap = actions.refreshTokenListMap.use();

  return useRef({
    refreshTokenList,
    refreshTokenListMap,
  });
}
