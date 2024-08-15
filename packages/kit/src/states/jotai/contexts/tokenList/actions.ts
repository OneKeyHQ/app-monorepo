import { useRef } from 'react';

import BigNumber from 'bignumber.js';
import { isEqual, uniqBy } from 'lodash';

import { TOKEN_LIST_HIGH_VALUE_MAX } from '@onekeyhq/shared/src/consts/walletConsts';
import { memoFn } from '@onekeyhq/shared/src/utils/cacheUtils';
import {
  mergeDeriveTokenList,
  mergeDeriveTokenListMap,
  sortTokensByFiatValue,
  sortTokensByOrder,
} from '@onekeyhq/shared/src/utils/tokenUtils';
import type { IAccountToken, ITokenFiat } from '@onekeyhq/shared/types/token';

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
  tokenSelectorSearchKeyAtom,
  tokenSelectorSearchTokenListAtom,
  tokenSelectorSearchTokenStateAtom,
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

  updateTokenSelectorSearchTokenState = contextAtomMethod(
    (
      get,
      set,
      payload: {
        isSearching: boolean;
      },
    ) => {
      set(tokenSelectorSearchTokenStateAtom(), {
        isSearching: payload.isSearching,
      });
    },
  );

  refreshTokenSelectorSearchTokenList = contextAtomMethod(
    (
      get,
      set,
      payload: {
        tokens: IAccountToken[];
      },
    ) => {
      set(tokenSelectorSearchTokenListAtom(), { tokens: payload.tokens });
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
      },
    ) => {
      const { keys, tokens, merge, mergeDerive } = payload;
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
        set(allTokenListAtom(), {
          tokens: uniqBy(tokens, (item) => item.$key),
          keys,
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
        mergeDerive?: boolean;
        split?: boolean;
      },
    ) => {
      const { keys, tokens, merge, mergeDerive, split } = payload;

      if (merge) {
        if (tokens.length) {
          let newTokens = get(tokenListAtom()).tokens.concat(
            get(smallBalanceTokenListAtom()).smallBalanceTokens,
          );

          newTokens = mergeDeriveTokenList({
            sourceTokens: tokens,
            targetTokens: newTokens,
            mergeDeriveAssets: mergeDerive,
          });

          const tokenListMap = get(tokenListMapAtom());

          const mergedTokenListMap = {
            ...tokenListMap,
            ...(payload.map || {}),
          };

          newTokens = sortTokensByFiatValue({
            tokens: newTokens,
            map: mergedTokenListMap,
          });

          const index = newTokens.findIndex((token) =>
            new BigNumber(
              mergedTokenListMap[token.$key]?.fiatValue ?? 0,
            ).isZero(),
          );

          if (index > -1) {
            const tokensWithBalance = newTokens.slice(0, index);
            let tokensWithZeroBalance = newTokens.slice(index);

            tokensWithZeroBalance = sortTokensByOrder({
              tokens: tokensWithZeroBalance,
            });

            newTokens = [...tokensWithBalance, ...tokensWithZeroBalance];
          }

          if (split) {
            const highValueTokens = newTokens.slice(
              0,
              TOKEN_LIST_HIGH_VALUE_MAX,
            );
            const lowValueTokens = newTokens.slice(TOKEN_LIST_HIGH_VALUE_MAX);

            const lowValueTokensFiatValue = lowValueTokens.reduce(
              (acc, item) =>
                acc.plus(mergedTokenListMap[item.$key]?.fiatValue ?? 0),
              new BigNumber(0),
            );

            set(tokenListAtom(), {
              tokens: uniqBy(highValueTokens, (item) => item.$key),
              keys: `${get(tokenListAtom()).keys}_${keys}`,
            });

            set(
              smallBalanceTokensFiatValueAtom(),
              lowValueTokensFiatValue.toFixed(),
            );

            set(smallBalanceTokenListAtom(), {
              smallBalanceTokens: lowValueTokens,
              keys: `${get(smallBalanceTokenListAtom()).keys}_${keys}`,
            });
          } else {
            set(tokenListAtom(), {
              tokens: uniqBy(newTokens, (item) => item.$key),
              keys,
            });
          }
        }
      } else if (!isEqual(get(tokenListAtom()).keys, keys)) {
        set(tokenListAtom(), {
          tokens: uniqBy(tokens, (item) => item.$key),
          keys,
        });
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
        mergeDerive?: boolean;
      },
    ) => {
      const { tokens, merge, mergeDerive } = payload;

      if (merge) {
        const tokenListMap = get(tokenListMapAtom());
        set(
          tokenListMapAtom(),
          mergeDeriveTokenListMap({
            sourceMap: tokens,
            targetMap: tokenListMap,
            mergeDeriveAssets: mergeDerive,
          }),
        );

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
        mergeDerive?: boolean;
        tokens?: IAccountToken[];
      },
    ) => {
      const { keys, smallBalanceTokens, merge, mergeDerive } = payload;

      if (merge) {
        if (smallBalanceTokens.length) {
          let newTokens = get(smallBalanceTokenListAtom()).smallBalanceTokens;

          newTokens = mergeDeriveTokenList({
            sourceTokens: smallBalanceTokens,
            targetTokens: newTokens,
            mergeDeriveAssets: mergeDerive,
          });

          set(smallBalanceTokenListAtom(), {
            smallBalanceTokens: uniqBy(newTokens, (item) => item.$key),
            keys: `${get(smallBalanceTokenListAtom()).keys}_${keys}`,
          });
        }
      } else if (!isEqual(get(smallBalanceTokenListAtom()).keys, keys)) {
        set(smallBalanceTokenListAtom(), {
          smallBalanceTokens: uniqBy(smallBalanceTokens, (item) => item.$key),
          keys,
        });
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
        mergeDerive?: boolean;
      },
    ) => {
      const { tokens, merge, mergeDerive } = payload;
      if (merge) {
        const tokenListMap = get(smallBalanceTokenListMapAtom());
        set(
          smallBalanceTokenListMapAtom(),
          mergeDeriveTokenListMap({
            sourceMap: tokens,
            targetMap: tokenListMap,
            mergeDeriveAssets: mergeDerive,
          }),
        );

        return;
      }

      set(smallBalanceTokenListMapAtom(), payload.tokens);
    },
  );

  refreshSmallBalanceTokensFiatValue = contextAtomMethod(
    (
      get,
      set,
      payload: {
        value: string;
        merge?: boolean;
      },
    ) => {
      const { value, merge } = payload;

      const smallBalanceTokensFiatValue = get(
        smallBalanceTokensFiatValueAtom(),
      );

      if (merge) {
        const mergedValue = new BigNumber(smallBalanceTokensFiatValue)
          .plus(value)
          .toFixed();
        set(smallBalanceTokensFiatValueAtom(), mergedValue);
        return;
      }

      set(smallBalanceTokensFiatValueAtom(), value);
    },
  );

  updateSearchKey = contextAtomMethod((get, set, value: string) => {
    set(searchKeyAtom(), value);
  });

  updateTokenSelectorSearchKey = contextAtomMethod(
    (get, set, value: string) => {
      set(tokenSelectorSearchKeyAtom(), value);
    },
  );

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

  const updateTokenSelectorSearchKey =
    actions.updateTokenSelectorSearchKey.use();

  const updateTokenSelectorSearchTokenState =
    actions.updateTokenSelectorSearchTokenState.use();

  const refreshTokenSelectorSearchTokenList =
    actions.refreshTokenSelectorSearchTokenList.use();

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
    updateTokenSelectorSearchKey,
    updateTokenSelectorSearchTokenState,
    refreshTokenSelectorSearchTokenList,
  });
}
