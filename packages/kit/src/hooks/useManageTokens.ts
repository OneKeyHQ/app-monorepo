import { useCallback, useEffect, useMemo } from 'react';

import { Token } from '@onekeyhq/engine/src/types/token';

import backgroundApiProxy from '../background/instance/backgroundApiProxy';
import {
  changeActiveOwnedToken,
  changeActiveTokens,
  updateTokensBalance,
  updateTokensPrice,
} from '../store/reducers/general';
import { ValuedToken } from '../store/typings';

import { useAppSelector } from './redux';

export const useManageTokens = ({
  pollingInterval = 0,
}: { pollingInterval?: number } = {}) => {
  const {
    activeAccountId,
    activeNetworkId,
    tokens,
    ownedTokens,
    tokensPrice,
    tokensBalance = {},
  } = useAppSelector((s) => s.general);
  const { dispatch } = backgroundApiProxy;

  const prices = useMemo(() => {
    if (!activeNetworkId) {
      return {};
    }
    return tokensPrice[activeNetworkId] ?? {};
  }, [tokensPrice, activeNetworkId]);

  const balances = useMemo(() => {
    if (!activeNetworkId || !activeAccountId) {
      return {};
    }
    return tokensBalance?.[activeAccountId]?.[activeNetworkId] ?? {};
  }, [tokensBalance, activeNetworkId, activeAccountId]);

  const { allTokens } = useMemo(() => {
    let data: Token[] = [];
    if (activeAccountId && activeNetworkId) {
      data = tokens[activeAccountId]?.[activeNetworkId] ?? [];
    }
    return { allTokens: data };
  }, [tokens, activeAccountId, activeNetworkId]);

  const { accountTokens, accountTokensMap, accountTokensSet, nativeToken } =
    useMemo(() => {
      let data: ValuedToken[] = [];
      const dataSet = new Set<string>();
      const dataMap = new Map<string, ValuedToken>();
      let dataNativeToken: ValuedToken | undefined;
      if (activeAccountId && activeNetworkId) {
        data = ownedTokens[activeAccountId]?.[activeNetworkId] ?? [];
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
    }, [ownedTokens, activeAccountId, activeNetworkId]);

  const updateAccountTokens = useCallback(() => {
    if (activeAccountId && activeNetworkId) {
      backgroundApiProxy.engine
        .getTokens(activeNetworkId, activeAccountId)
        .then((list) => {
          if (accountTokens.length === 0) {
            dispatch(changeActiveOwnedToken(list.map((item) => ({ ...item }))));
          }
          const addressList = list
            .filter((i) => i.tokenIdOnNetwork)
            .map((token) => token.tokenIdOnNetwork);

          backgroundApiProxy.engine
            .getPrices(activeNetworkId, addressList, true)
            .then((priceData) => {
              dispatch(updateTokensPrice(priceData));
            });

          backgroundApiProxy.engine
            .getAccountBalance(
              activeAccountId,
              activeNetworkId,
              addressList,
              true,
            )
            .then((balanceData) => {
              dispatch(updateTokensBalance(balanceData));
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
  }, [activeAccountId, activeNetworkId, dispatch, accountTokens.length]);

  // TODO move to background Service
  const updateTokens = useCallback(() => {
    (async () => {
      if (activeAccountId && activeNetworkId) {
        const topTokens = await backgroundApiProxy.engine.getTopTokensOnNetwork(
          activeNetworkId,
          50,
        );
        dispatch(changeActiveTokens(topTokens));
        const accountBalances =
          await backgroundApiProxy.engine.getAccountBalance(
            activeAccountId,
            activeNetworkId,
            topTokens.map((i) => i.tokenIdOnNetwork),
            true,
          );
        dispatch(updateTokensBalance(accountBalances));
      }
    })();
  }, [activeAccountId, activeNetworkId, dispatch]);

  useEffect(() => {
    let timer: ReturnType<typeof setInterval> | undefined;
    if (pollingInterval) {
      updateAccountTokens();
      timer = setInterval(() => {
        updateAccountTokens();
      }, pollingInterval);
    }

    return () => {
      if (timer) {
        clearInterval(timer);
      }
    };
  }, [pollingInterval, updateAccountTokens]);

  return {
    nativeToken,
    accountTokensMap,
    accountTokensSet,
    accountTokens,
    allTokens,
    prices,
    balances,
    updateTokens,
    updateAccountTokens,
  };
};
