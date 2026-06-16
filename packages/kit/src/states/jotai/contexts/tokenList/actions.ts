import { useRef } from 'react';

import { isEqual, uniqBy } from 'lodash';

import { memoFn } from '@onekeyhq/shared/src/utils/cacheUtils';
import {
  mergeDeriveTokenList,
  mergeDeriveTokenListMap,
  sortTokensByFiatValue,
} from '@onekeyhq/shared/src/utils/tokenUtils';
import type {
  ETokenListSortType,
  IAccountToken,
  ITokenFiat,
} from '@onekeyhq/shared/types/token';

import { ContextJotaiActionsBase } from '../../utils/ContextJotaiActionsBase';

import {
  activeAccountTokenListAtom,
  activeAccountTokenListStateAtom,
  allTokenListAtom,
  allTokenListMapAtom,
  contextAtomMethod,
  createAccountStateAtom,
  processingTokenStateAtom,
  riskyTokenListAtom,
  riskyTokenListMapAtom,
  searchKeyAtom,
  searchTokenListAtom,
  searchTokenStateAtom,
  tokenListSortAtom,
  tokenListStateAtom,
} from './atoms';

class ContextJotaiActionsTokenList extends ContextJotaiActionsBase {
  updateSearchTokenState = contextAtomMethod(
    (
      get,
      set,
      payload: {
        isSearching: boolean;
      },
    ) => {
      set(searchTokenStateAtom(), { isSearching: payload.isSearching });
    },
  );

  refreshSearchTokenList = contextAtomMethod(
    (
      get,
      set,
      payload: {
        tokens: IAccountToken[];
      },
    ) => {
      set(searchTokenListAtom(), { tokens: payload.tokens });
    },
  );

  refreshAllTokenList = contextAtomMethod(
    (
      get,
      set,
      payload: {
        tokens: IAccountToken[];
        keys: string;
        merge?: boolean;
        map?: {
          [key: string]: ITokenFiat;
        };
        mergeDerive?: boolean;
        accountId?: string;
        networkId?: string;
      },
    ) => {
      const { keys, tokens, merge, mergeDerive, accountId, networkId } =
        payload;
      const allTokenList = get(allTokenListAtom());

      if (merge) {
        if (tokens.length) {
          let newTokens = allTokenList.tokens;

          newTokens = mergeDeriveTokenList({
            sourceTokens: tokens,
            targetTokens: newTokens,
            mergeDeriveAssets: mergeDerive,
          });

          const tokenListMap = get(allTokenListMapAtom());

          newTokens = sortTokensByFiatValue({
            tokens: uniqBy(newTokens, (item) => item.$key),
            map: {
              ...tokenListMap,
              // The aggregate fiat map is already merged into `payload.map` by
              // the home producer (e.g. `flattenLocalAggregateTokenMap`); the
              // dedicated aggregate atom was removed in the tokenList SLC
              // full-delete (PR-8).
              ...payload.map,
            },
          });

          set(allTokenListAtom(), {
            tokens: newTokens,
            keys: `${allTokenList.keys}_${keys}`,
            accountId,
            networkId,
          });
        }
      } else if (!isEqual(allTokenList.keys, keys)) {
        set(allTokenListAtom(), {
          tokens: uniqBy(tokens, (item) => item.$key),
          keys,
          accountId,
          networkId,
        });
      }
    },
  );

  refreshAllTokenListMap = contextAtomMethod(
    (
      get,
      set,
      payload: {
        tokens: {
          [key: string]: ITokenFiat;
        };
        merge?: boolean;
        mergeDerive?: boolean;
      },
    ) => {
      const { tokens, merge, mergeDerive } = payload;
      if (merge) {
        const tokenListMap = get(allTokenListMapAtom());
        set(
          allTokenListMapAtom(),
          mergeDeriveTokenListMap({
            sourceMap: tokens,
            targetMap: tokenListMap,
            mergeDeriveAssets: mergeDerive,
          }),
        );

        return;
      }

      set(allTokenListMapAtom(), tokens);
    },
  );

  refreshActiveAccountTokenList = contextAtomMethod(
    (
      get,
      set,
      payload: {
        tokens: IAccountToken[];
        keys: string;
      },
    ) => {
      set(activeAccountTokenListAtom(), {
        tokens: uniqBy(payload.tokens, (item) => item.$key),
        keys: payload.keys,
      });
    },
  );

  refreshRiskyTokenList = contextAtomMethod(
    (
      get,
      set,
      payload: {
        riskyTokens: IAccountToken[];
        keys: string;
        merge?: boolean;
        map?: {
          [key: string]: ITokenFiat;
        };
        mergeDerive?: boolean;
      },
    ) => {
      const { keys, riskyTokens, merge, mergeDerive } = payload;

      if (merge) {
        if (riskyTokens.length) {
          let newTokens = get(riskyTokenListAtom()).riskyTokens;

          newTokens = mergeDeriveTokenList({
            sourceTokens: riskyTokens,
            targetTokens: newTokens,
            mergeDeriveAssets: mergeDerive,
          });

          set(riskyTokenListAtom(), {
            riskyTokens: uniqBy(newTokens, (item) => item.$key),
            keys: `${get(riskyTokenListAtom()).keys}_${keys}`,
          });
        }
      } else if (!isEqual(get(riskyTokenListAtom()).keys, keys)) {
        set(riskyTokenListAtom(), {
          riskyTokens: uniqBy(riskyTokens, (item) => item.$key),
          keys,
        });
      }
    },
  );

  refreshRiskyTokenListMap = contextAtomMethod(
    (
      get,
      set,
      payload: {
        tokens: {
          [key: string]: ITokenFiat;
        };
        merge?: boolean;
        mergeDerive?: boolean;
      },
    ) => {
      const { tokens, merge, mergeDerive } = payload;
      if (merge) {
        const tokenListMap = get(riskyTokenListMapAtom());
        set(
          riskyTokenListMapAtom(),
          mergeDeriveTokenListMap({
            sourceMap: tokens,
            targetMap: tokenListMap,
            mergeDeriveAssets: mergeDerive,
          }),
        );

        return;
      }

      set(riskyTokenListMapAtom(), payload.tokens);
    },
  );

  updateSearchKey = contextAtomMethod((get, set, value: string) => {
    set(searchKeyAtom(), value);
  });

  updateTokenListState = contextAtomMethod(
    (
      get,
      set,
      payload: {
        address?: string;
        isRefreshing?: boolean;
        initialized?: boolean;
      },
    ) => {
      set(tokenListStateAtom(), (v) => ({
        ...v,
        ...payload,
      }));
    },
  );

  updateActiveAccountTokenListState = contextAtomMethod(
    (
      get,
      set,
      payload: {
        isRefreshing?: boolean;
        initialized?: boolean;
      },
    ) => {
      set(activeAccountTokenListStateAtom(), (v) => ({
        ...v,
        ...payload,
      }));
    },
  );

  updateCreateAccountState = contextAtomMethod(
    (
      get,
      set,
      payload: {
        isCreating?: boolean;
        token?: IAccountToken | null;
      },
    ) => {
      set(createAccountStateAtom(), {
        ...get(createAccountStateAtom()),
        ...payload,
      });
    },
  );

  updateProcessingTokenState = contextAtomMethod(
    (
      get,
      set,
      payload: {
        isProcessing?: boolean;
        token?: IAccountToken | null;
      },
    ) => {
      set(processingTokenStateAtom(), {
        ...get(processingTokenStateAtom()),
        ...payload,
      });
    },
  );

  updateTokenListSort = contextAtomMethod(
    (
      get,
      set,
      payload: {
        sortType: ETokenListSortType;
        sortDirection?: 'desc' | 'asc';
      },
    ) => {
      const { sortType } = get(tokenListSortAtom());

      if (payload.sortType !== sortType) {
        set(tokenListSortAtom(), {
          sortType: payload.sortType,
          sortDirection: 'desc',
        });
        return;
      }

      set(tokenListSortAtom(), (v) => ({
        ...v,
        ...payload,
      }));
    },
  );
}

const createActions = memoFn(() => {
  // console.log('new ContextJotaiActionsTokenList()', Date.now());
  return new ContextJotaiActionsTokenList();
});

export function useTokenListActions() {
  const actions = createActions();
  const refreshAllTokenList = actions.refreshAllTokenList.use();
  const refreshAllTokenListMap = actions.refreshAllTokenListMap.use();
  const refreshRiskyTokenList = actions.refreshRiskyTokenList.use();
  const refreshRiskyTokenListMap = actions.refreshRiskyTokenListMap.use();

  const refreshSearchTokenList = actions.refreshSearchTokenList.use();

  const updateSearchKey = actions.updateSearchKey.use();

  const updateTokenListState = actions.updateTokenListState.use();

  const updateSearchTokenState = actions.updateSearchTokenState.use();

  const updateCreateAccountState = actions.updateCreateAccountState.use();

  const updateProcessingTokenState = actions.updateProcessingTokenState.use();

  const refreshActiveAccountTokenList =
    actions.refreshActiveAccountTokenList.use();

  const updateActiveAccountTokenListState =
    actions.updateActiveAccountTokenListState.use();

  const updateTokenListSort = actions.updateTokenListSort.use();

  return useRef({
    refreshSearchTokenList,
    refreshAllTokenList,
    refreshAllTokenListMap,
    refreshRiskyTokenList,
    refreshRiskyTokenListMap,
    updateSearchKey,
    updateTokenListState,
    updateSearchTokenState,
    updateCreateAccountState,
    updateProcessingTokenState,
    refreshActiveAccountTokenList,
    updateActiveAccountTokenListState,
    updateTokenListSort,
  });
}
