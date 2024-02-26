import { useRef } from 'react';

import { isEqual } from 'lodash';

import { memoFn } from '@onekeyhq/shared/src/utils/cacheUtils';
import type { IAccountToken, ITokenFiat } from '@onekeyhq/shared/types/token';

import { ContextJotaiActionsBase } from '../../utils/ContextJotaiActionsBase';

import {
  allTokenListAtom,
  allTokenListMapAtom,
  contextAtomMethod,
  riskyTokenListAtom,
  riskyTokenListMapAtom,
  searchKeyAtom,
  smallBalanceTokenListAtom,
  smallBalanceTokenListMapAtom,
  smallBalanceTokensFiatValueAtom,
  tokenListAtom,
  tokenListInitializedAtom,
  tokenListMapAtom,
} from './atoms';

class ContextJotaiActionsTokenList extends ContextJotaiActionsBase {
  refreshAllTokenList = contextAtomMethod(
    (
      get,
      set,
      payload: {
        tokens: IAccountToken[];
        keys: string;
      },
    ) => {
      const { keys, tokens } = payload;

      if (!isEqual(get(allTokenListAtom()).keys, keys)) {
        set(allTokenListAtom(), { tokens, keys });
      }
    },
  );

  refreshAllTokenListMap = contextAtomMethod(
    (
      get,
      set,
      payload: {
        [key: string]: ITokenFiat;
      },
    ) => {
      set(allTokenListMapAtom(), payload);
    },
  );

  refreshTokenList = contextAtomMethod(
    (
      get,
      set,
      payload: {
        tokens: IAccountToken[];
        keys: string;
      },
    ) => {
      const { keys, tokens } = payload;

      if (!isEqual(get(tokenListAtom()).keys, keys)) {
        set(tokenListAtom(), { tokens, keys });
      }
    },
  );

  refreshTokenListMap = contextAtomMethod(
    (
      get,
      set,
      payload: {
        [key: string]: ITokenFiat;
      },
    ) => {
      set(tokenListMapAtom(), payload);
    },
  );

  refreshRiskyTokenList = contextAtomMethod(
    (
      get,
      set,
      payload: {
        riskyTokens: IAccountToken[];
        keys: string;
      },
    ) => {
      const { keys, riskyTokens } = payload;

      if (!isEqual(get(riskyTokenListAtom()).keys, keys)) {
        set(riskyTokenListAtom(), { riskyTokens, keys });
      }
    },
  );

  refreshRiskyTokenListMap = contextAtomMethod(
    (
      get,
      set,
      payload: {
        [key: string]: ITokenFiat;
      },
    ) => {
      set(riskyTokenListMapAtom(), payload);
    },
  );

  refreshSmallBalanceTokenList = contextAtomMethod(
    (
      get,
      set,
      payload: {
        smallBalanceTokens: IAccountToken[];
        keys: string;
      },
    ) => {
      const { keys, smallBalanceTokens } = payload;

      if (!isEqual(get(smallBalanceTokenListAtom()).keys, keys)) {
        set(smallBalanceTokenListAtom(), { smallBalanceTokens, keys });
      }
    },
  );

  refreshSmallBalanceTokenListMap = contextAtomMethod(
    (
      get,
      set,
      payload: {
        [key: string]: ITokenFiat;
      },
    ) => {
      set(smallBalanceTokenListMapAtom(), payload);
    },
  );

  refreshSmallBalanceTokensFiatValue = contextAtomMethod(
    (get, set, value: string) => {
      set(smallBalanceTokensFiatValueAtom(), value);
    },
  );

  updateTokenListInitialized = contextAtomMethod((get, set, value: boolean) => {
    set(tokenListInitializedAtom(), value);
  });

  updateSearchKey = contextAtomMethod((get, set, value: string) => {
    set(searchKeyAtom(), value);
  });
}

const createActions = memoFn(() => {
  console.log('new ContextJotaiActionsTokenList()', Date.now());
  return new ContextJotaiActionsTokenList();
});

export function useTokenListActions() {
  const actions = createActions();
  const refreshAllTokenList = actions.refreshAllTokenList.use();
  const refreshAllTokenListMap = actions.refreshAllTokenListMap.use();
  const refreshTokenList = actions.refreshTokenList.use();
  const refreshTokenListMap = actions.refreshTokenListMap.use();
  const refreshRiskyTokenList = actions.refreshRiskyTokenList.use();
  const refreshRiskyTokenListMap = actions.refreshRiskyTokenListMap.use();
  const refreshSmallBalanceTokenList =
    actions.refreshSmallBalanceTokenList.use();
  const refreshSmallBalanceTokenListMap =
    actions.refreshSmallBalanceTokenListMap.use();

  const refreshSmallBalanceTokensFiatValue =
    actions.refreshSmallBalanceTokensFiatValue.use();

  const updateSearchKey = actions.updateSearchKey.use();

  const updateTokenListInitialized = actions.updateTokenListInitialized.use();

  return useRef({
    refreshAllTokenList,
    refreshAllTokenListMap,
    refreshTokenList,
    refreshTokenListMap,
    refreshRiskyTokenList,
    refreshRiskyTokenListMap,
    refreshSmallBalanceTokenList,
    refreshSmallBalanceTokenListMap,
    refreshSmallBalanceTokensFiatValue,
    updateSearchKey,
    updateTokenListInitialized,
  });
}
