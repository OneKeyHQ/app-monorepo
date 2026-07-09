import { useRef } from 'react';

import { uniqBy } from 'lodash';

import { memoFn } from '@onekeyhq/shared/src/utils/cacheUtils';
import type {
  ETokenListSortType,
  IAccountToken,
} from '@onekeyhq/shared/types/token';

import { ContextJotaiActionsBase } from '../../utils/ContextJotaiActionsBase';

import {
  activeAccountTokenListAtom,
  activeAccountTokenListStateAtom,
  contextAtomMethod,
  createAccountStateAtom,
  processingTokenStateAtom,
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
