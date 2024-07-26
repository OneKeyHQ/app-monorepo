import { useRef } from 'react';

import { isEqual, uniqBy } from 'lodash';

import { memoFn } from '@onekeyhq/shared/src/utils/cacheUtils';
import { sortTokensByFiatValue } from '@onekeyhq/shared/src/utils/tokenUtils';
import type {
  IAccountToken,
  IToken,
  ITokenFiat,
} from '@onekeyhq/shared/types/token';

import { ContextJotaiActionsBase } from '../../utils/ContextJotaiActionsBase';

import {
  allTokenListAtom,
  allTokenListMapAtom,
  contextAtomMethod,
  createAccountStateAtom,
  riskyTokenListAtom,
  riskyTokenListMapAtom,
  searchKeyAtom,
  searchTokenListAtom,
  searchTokenStateAtom,
  smallBalanceTokenListAtom,
  smallBalanceTokenListMapAtom,
  smallBalanceTokensFiatValueAtom,
  tokenListAtom,
  tokenListMapAtom,
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
      },
    ) => {
      const { keys, tokens } = payload;
      const allTokenList = get(allTokenListAtom());

      if (payload.merge) {
        if (tokens.length) {
          let newTokens = allTokenList.tokens.concat(tokens);

          const tokenListMap = get(tokenListMapAtom());

          newTokens = sortTokensByFiatValue({
            tokens: newTokens,
            map: {
              ...tokenListMap,
              ...(payload.map || {}),
            },
          });

          set(allTokenListAtom(), {
            tokens: newTokens,
            keys: `${allTokenList.keys}_${keys}`,
          });
        }
      } else if (!isEqual(allTokenList.keys, keys)) {
        set(allTokenListAtom(), { tokens, keys });
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
      },
    ) => {
      if (payload.merge) {
        set(allTokenListMapAtom(), {
          ...get(allTokenListMapAtom()),
          ...payload.tokens,
        });
        return;
      }

      set(allTokenListMapAtom(), payload.tokens);
    },
  );

  refreshTokenList = contextAtomMethod(
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
      },
    ) => {
      const { keys, tokens } = payload;

      if (payload.merge) {
        if (tokens.length) {
          let newTokens = get(tokenListAtom()).tokens.concat(tokens);

          const tokenListMap = get(tokenListMapAtom());

          newTokens = sortTokensByFiatValue({
            tokens: newTokens,
            map: {
              ...tokenListMap,
              ...(payload.map || {}),
            },
          });

          set(tokenListAtom(), {
            tokens: uniqBy(newTokens, (item) => item.$key),
            keys: `${get(tokenListAtom()).keys}_${keys}`,
          });
        }
      } else if (!isEqual(get(tokenListAtom()).keys, keys)) {
        set(tokenListAtom(), { tokens, keys });
      }
    },
  );

  refreshTokenListMap = contextAtomMethod(
    (
      get,
      set,
      payload: {
        tokens: {
          [key: string]: ITokenFiat;
        };
        merge?: boolean;
      },
    ) => {
      if (payload.merge) {
        set(tokenListMapAtom(), {
          ...get(tokenListMapAtom()),
          ...payload.tokens,
        });
        return;
      }

      set(tokenListMapAtom(), payload.tokens);
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
      },
    ) => {
      const { keys, riskyTokens } = payload;

      if (payload.merge) {
        if (riskyTokens.length) {
          let newTokens = get(riskyTokenListAtom()).riskyTokens.concat(
            riskyTokens,
          );

          const tokenListMap = get(riskyTokenListMapAtom());

          newTokens = sortTokensByFiatValue({
            tokens: newTokens,
            map: {
              ...tokenListMap,
              ...(payload.map || {}),
            },
          });

          set(riskyTokenListAtom(), {
            riskyTokens: uniqBy(newTokens, (item) => item.$key),
            keys: `${get(riskyTokenListAtom()).keys}_${keys}`,
          });
        }
      } else if (!isEqual(get(riskyTokenListAtom()).keys, keys)) {
        set(riskyTokenListAtom(), { riskyTokens, keys });
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
      },
    ) => {
      if (payload.merge) {
        set(riskyTokenListMapAtom(), {
          ...get(riskyTokenListMapAtom()),
          ...payload.tokens,
        });
        return;
      }

      set(riskyTokenListMapAtom(), payload.tokens);
    },
  );

  refreshSmallBalanceTokenList = contextAtomMethod(
    (
      get,
      set,
      payload: {
        smallBalanceTokens: IAccountToken[];
        keys: string;
        merge?: boolean;
        map?: {
          [key: string]: ITokenFiat;
        };
      },
    ) => {
      const { keys, smallBalanceTokens } = payload;

      if (payload.merge) {
        if (smallBalanceTokens.length) {
          let newTokens = get(
            smallBalanceTokenListAtom(),
          ).smallBalanceTokens.concat(smallBalanceTokens);

          const tokenListMap = get(smallBalanceTokenListMapAtom());

          newTokens = sortTokensByFiatValue({
            tokens: newTokens,
            map: {
              ...tokenListMap,
              ...(payload.map || {}),
            },
          });

          set(smallBalanceTokenListAtom(), {
            smallBalanceTokens: uniqBy(newTokens, (item) => item.$key),
            keys: `${get(smallBalanceTokenListAtom()).keys}_${keys}`,
          });
        }
      } else if (!isEqual(get(smallBalanceTokenListAtom()).keys, keys)) {
        set(smallBalanceTokenListAtom(), { smallBalanceTokens, keys });
      }
    },
  );

  refreshSmallBalanceTokenListMap = contextAtomMethod(
    (
      get,
      set,
      payload: {
        tokens: {
          [key: string]: ITokenFiat;
        };
        merge?: boolean;
      },
    ) => {
      if (payload.merge) {
        set(smallBalanceTokenListMapAtom(), {
          ...get(smallBalanceTokenListMapAtom()),
          ...payload.tokens,
        });
        return;
      }

      set(smallBalanceTokenListMapAtom(), payload.tokens);
    },
  );

  refreshSmallBalanceTokensFiatValue = contextAtomMethod(
    (get, set, value: string) => {
      set(smallBalanceTokensFiatValueAtom(), value);
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
      set(tokenListStateAtom(), {
        ...get(tokenListStateAtom()),
        ...payload,
      });
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

  const refreshSearchTokenList = actions.refreshSearchTokenList.use();

  const updateSearchKey = actions.updateSearchKey.use();

  const updateTokenListState = actions.updateTokenListState.use();

  const updateSearchTokenState = actions.updateSearchTokenState.use();

  const updateCreateAccountState = actions.updateCreateAccountState.use();

  return useRef({
    refreshSearchTokenList,
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
    updateTokenListState,
    updateSearchTokenState,
    updateCreateAccountState,
  });
}
