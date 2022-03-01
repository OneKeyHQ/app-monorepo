import { useCallback, useMemo } from 'react';

import { Token } from '@onekeyhq/engine/src/types/token';

import engine from '../engine/EngineProvider';
import {
  ValuedToken,
  changeActiveOwnedToken,
  changeActiveTokens,
} from '../store/reducers/general';

import { useAppDispatch, useAppSelector } from './redux';

export const useManageTokens = () => {
  const { activeAccount, activeNetwork, tokens, ownedTokens } = useAppSelector(
    (s) => s.general,
  );
  const dispatch = useAppDispatch();

  const { allTokens } = useMemo(() => {
    let allListData: Token[] = [];
    if (activeAccount && activeNetwork) {
      allListData =
        tokens[activeAccount?.id]?.[activeNetwork?.network.id] ?? [];
    }
    return { allTokens: allListData };
  }, [tokens, activeAccount, activeNetwork]);

  const { accountTokens, accountTokensMap, accountTokensSet, nativeToken } =
    useMemo(() => {
      let data: ValuedToken[] = [];
      const dataSet = new Set<string>();
      const dataMap = new Map<string, ValuedToken>();
      let dataNativeToken: ValuedToken | undefined;
      if (activeAccount && activeNetwork) {
        data =
          ownedTokens[activeAccount?.id]?.[activeNetwork?.network.id] ?? [];
      }
      data.forEach((token) => {
        if (token.tokenIdOnNetwork) {
          dataSet.add(token.tokenIdOnNetwork);
          dataMap.set(token.tokenIdOnNetwork, token);
        } else {
          dataNativeToken = token;
        }
      });
      return {
        accountTokens: data,
        accountTokensMap: dataMap,
        accountTokensSet: dataSet,
        nativeToken: dataNativeToken,
      };
    }, [ownedTokens, activeAccount, activeNetwork]);

  const updateAccountTokens = useCallback(() => {
    if (activeAccount && activeNetwork) {
      const networkId = activeNetwork.network.id;
      const accountId = activeAccount.id;
      engine.getTokens(networkId, accountId).then((list) => {
        if (
          networkId !== activeNetwork.network.id ||
          accountId !== activeAccount.id
        ) {
          return;
        }
        if (accountTokens.length === 0) {
          dispatch(
            changeActiveOwnedToken(
              list.map((item) => ({ ...item, balance: '0' })),
            ),
          );
        }
        engine
          .getAccountBalance(
            accountId,
            networkId,
            list
              .filter((i) => i.tokenIdOnNetwork)
              .map((token) => token.tokenIdOnNetwork),
            true,
          )
          .then((balanceData) => {
            if (
              networkId !== activeNetwork.network.id ||
              accountId !== activeAccount.id
            ) {
              return;
            }
            const listWithBalances = list.map((item) => {
              const data = {
                ...item,
                balance: item.tokenIdOnNetwork
                  ? balanceData[item.tokenIdOnNetwork]?.toString()
                  : balanceData.main?.toString(),
              };
              return data;
            });
            dispatch(changeActiveOwnedToken(listWithBalances));
          });
      });
    }
  }, [activeAccount, activeNetwork, dispatch, accountTokens.length]);

  const updateTokens = useCallback(() => {
    if (activeAccount && activeNetwork) {
      dispatch(
        changeActiveTokens(
          engine.getTopTokensOnNetwork(activeNetwork.network.id, 50),
        ),
      );
    }
  }, [activeAccount, activeNetwork, dispatch]);

  return {
    nativeToken,
    accountTokensMap,
    accountTokensSet,
    accountTokens,
    allTokens,
    updateTokens,
    updateAccountTokens,
  };
};
