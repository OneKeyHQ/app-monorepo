import { useCallback, useMemo } from 'react';

import { Token } from '@onekeyhq/engine/src/types/token';

import backgroundApiProxy from '../background/instance/backgroundApiProxy';
import {
  ValuedToken,
  changeActiveOwnedToken,
  changeActiveTokens,
  updateTokensPrice,
} from '../store/reducers/general';

import { useAppSelector } from './redux';

export const useManageTokens = () => {
  const { activeAccount, activeNetwork, tokens, ownedTokens, tokensPrice } =
    useAppSelector((s) => s.general);
  const { dispatch } = backgroundApiProxy;

  const prices = useMemo(() => {
    if (!activeNetwork) {
      return {};
    }
    return tokensPrice[activeNetwork.network.id] ?? {};
  }, [tokensPrice, activeNetwork]);

  const { allTokens } = useMemo(() => {
    let data: Token[] = [];
    if (activeAccount && activeNetwork) {
      data = tokens[activeAccount?.id]?.[activeNetwork?.network.id] ?? [];
    }
    return { allTokens: data };
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
      backgroundApiProxy.engine.getTokens(networkId, accountId).then((list) => {
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
        const addressList = list
          .filter((i) => i.tokenIdOnNetwork)
          .map((token) => token.tokenIdOnNetwork);

        backgroundApiProxy.engine
          .getPrices(activeNetwork.network.id, addressList, true)
          .then((priceData) => {
            if (networkId !== activeNetwork.network.id) {
              return;
            }
            dispatch(updateTokensPrice(priceData));
          });

        backgroundApiProxy.engine
          .getAccountBalance(accountId, networkId, addressList, true)
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

  // TODO move to background Service
  const updateTokens = useCallback(() => {
    (async () => {
      if (activeAccount && activeNetwork) {
        const topTokens = await backgroundApiProxy.engine.getTopTokensOnNetwork(
          activeNetwork.network.id,
          50,
        );
        dispatch(changeActiveTokens(topTokens));
      }
    })();
  }, [activeAccount, activeNetwork, dispatch]);

  return {
    nativeToken,
    accountTokensMap,
    accountTokensSet,
    accountTokens,
    allTokens,
    prices,
    updateTokens,
    updateAccountTokens,
  };
};
