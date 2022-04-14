import { useCallback, useEffect, useMemo } from 'react';

import { Token } from '@onekeyhq/engine/src/types/token';

import backgroundApiProxy from '../background/instance/backgroundApiProxy';
import {
  ValuedToken,
  changeActiveOwnedToken,
  changeActiveTokens,
  updateTokensPrice,
} from '../store/reducers/general';

import { useActiveWalletAccount, useGeneral } from './redux';

export const useManageTokens = ({
  pollingInterval = 0,
}: { pollingInterval?: number } = {}) => {
  const { tokens, ownedTokens, tokensPrice } = useGeneral();
  const { account: activeAccount, network: activeNetwork } =
    useActiveWalletAccount();
  const { dispatch } = backgroundApiProxy;

  const prices = useMemo(() => {
    if (!activeNetwork) {
      return {};
    }
    return tokensPrice[activeNetwork?.id] ?? {};
  }, [tokensPrice, activeNetwork]);

  const { allTokens } = useMemo(() => {
    let data: Token[] = [];
    if (activeAccount && activeNetwork) {
      data = tokens[activeAccount?.id]?.[activeNetwork?.id] ?? [];
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
        data = ownedTokens[activeAccount?.id]?.[activeNetwork?.id] ?? [];
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
    if (activeAccount?.id && activeNetwork?.id) {
      const networkId = activeNetwork.id;
      const accountId = activeAccount.id;
      backgroundApiProxy.engine.getTokens(networkId, accountId).then((list) => {
        if (networkId !== activeNetwork.id || accountId !== activeAccount.id) {
          return;
        }
        if (accountTokens.length === 0) {
          dispatch(changeActiveOwnedToken(list.map((item) => ({ ...item }))));
        }
        const addressList = list
          .filter((i) => i.tokenIdOnNetwork)
          .map((token) => token.tokenIdOnNetwork);

        backgroundApiProxy.engine
          .getPrices(activeNetwork.id, addressList, true)
          .then((priceData) => {
            if (networkId !== activeNetwork.id) {
              return;
            }
            dispatch(updateTokensPrice(priceData));
          });

        backgroundApiProxy.engine
          .getAccountBalance(accountId, networkId, addressList, true)
          .then((balanceData) => {
            if (
              networkId !== activeNetwork.id ||
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
  }, [activeAccount?.id, activeNetwork?.id, dispatch, accountTokens.length]);

  // TODO move to background Service
  const updateTokens = useCallback(() => {
    (async () => {
      if (activeAccount && activeNetwork) {
        const topTokens = await backgroundApiProxy.engine.getTopTokensOnNetwork(
          activeNetwork.id,
          50,
        );
        dispatch(changeActiveTokens(topTokens));
      }
    })();
  }, [activeAccount, activeNetwork, dispatch]);

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

  return useMemo(
    () => ({
      nativeToken,
      accountTokensMap,
      accountTokensSet,
      accountTokens,
      allTokens,
      prices,
      updateTokens,
      updateAccountTokens,
    }),
    [
      nativeToken,
      accountTokensMap,
      accountTokensSet,
      accountTokens,
      allTokens,
      prices,
      updateTokens,
      updateAccountTokens,
    ],
  );
};
