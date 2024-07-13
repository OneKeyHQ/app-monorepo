import { useRef } from 'react';

import { isEqual, uniqBy } from 'lodash';

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
  tokenListMapAtom,
  tokenListStateAtom,
} from './atoms';

class ContextJotaiActionsTokenList extends ContextJotaiActionsBase {
  refreshAllTokenList = contextAtomMethod(
    (
      get,
      set,
      payload: {
        tokens: IAccountToken[];
        keys: string;
        merge?: boolean;
      },
    ) => {
      const { keys, tokens } = payload;

      const allTokenList = get(allTokenListAtom());

      if (payload.merge) {
        const newTokens = allTokenList.tokens.concat(tokens);
        set(allTokenListAtom(), {
          tokens: newTokens,
          keys: `${allTokenList.keys}_${keys}`,
        });
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
        networkId?: string;
      },
    ) => {
      const { keys, tokens, networkId } = payload;

      if (payload.merge) {
        if (tokens.length) {
          const newTokens = get(tokenListAtom()).tokens.concat(tokens);
          set(tokenListAtom(), {
            tokens: uniqBy(
              newTokens,
              (item) => `${item.$key}_${networkId ?? ''}`,
            ),
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
        networkId?: string;
      },
    ) => {
      const { keys, riskyTokens, networkId } = payload;

      if (payload.merge) {
        if (riskyTokens.length) {
          const newTokens = get(riskyTokenListAtom()).riskyTokens.concat(
            riskyTokens,
          );
          set(riskyTokenListAtom(), {
            riskyTokens: uniqBy(
              newTokens,
              (item) => `${item.$key}_${networkId ?? ''}`,
            ),
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
        networkId?: string;
      },
    ) => {
      const { keys, smallBalanceTokens, networkId } = payload;

      if (payload.merge) {
        if (smallBalanceTokens.length) {
          const newTokens = get(
            smallBalanceTokenListAtom(),
          ).smallBalanceTokens.concat(smallBalanceTokens);
          set(smallBalanceTokenListAtom(), {
            smallBalanceTokens: uniqBy(
              newTokens,
              (item) => `${item.$key}_${networkId ?? ''}`,
            ),
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

  const updateTokenListState = actions.updateTokenListState.use();

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
    updateTokenListState,
  });
}
