import { useCallback, useEffect, useMemo } from 'react';

import { useIsFocused } from '@react-navigation/native';

import { Token } from '@onekeyhq/engine/src/types/token';

import backgroundApiProxy from '../background/instance/backgroundApiProxy';

import { useAppSelector } from './redux';

export const useManageTokens = ({
  pollingInterval = 0,
  fetchTokensOnMount = false,
}: {
  pollingInterval?: number;
  fetchTokensOnMount?: boolean;
} = {}) => {
  const isFocused = useIsFocused();

  const { activeAccountId, activeNetworkId } = useAppSelector((s) => s.general);
  const {
    tokens,
    tokensPrice,
    accountTokens: userTokens,
    accountTokensBalance,
  } = useAppSelector((s) => s.tokens);
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
    return accountTokensBalance?.[activeNetworkId]?.[activeAccountId] ?? {};
  }, [accountTokensBalance, activeNetworkId, activeAccountId]);

  const allTokens = useMemo(() => {
    let data: Token[] = [];
    if (activeNetworkId) {
      data = tokens[activeNetworkId] ?? [];
    }
    return data;
  }, [tokens, activeNetworkId]);

  const { accountTokens, accountTokensMap, nativeToken } = useMemo(() => {
    let data: Token[] = [];
    const dataMap = new Map<string, Token>();
    let dataNativeToken: Token | undefined;
    if (activeAccountId && activeNetworkId) {
      data = userTokens[activeNetworkId]?.[activeAccountId] ?? [];
    }
    data.forEach((token) => {
      if (token.tokenIdOnNetwork) {
        dataMap.set(token.tokenIdOnNetwork, token);
      } else {
        dataNativeToken = token;
      }
    });
    return {
      accountTokens: data,
      accountTokensMap: dataMap,
      nativeToken: dataNativeToken,
    };
  }, [userTokens, activeAccountId, activeNetworkId]);

  useEffect(() => {
    let timer: ReturnType<typeof setInterval> | undefined;
    if (pollingInterval && isFocused && activeAccountId && activeNetworkId) {
      // TODO may cause circular refresh in UI
      backgroundApiProxy.serviceToken.fetchAccountTokens();
      timer = setInterval(() => {
        backgroundApiProxy.serviceToken.fetchAccountTokens();
      }, pollingInterval);
    }
    return () => {
      if (timer) {
        clearInterval(timer);
      }
    };
  }, [isFocused, pollingInterval, activeAccountId, activeNetworkId]);

  useEffect(() => {
    if (fetchTokensOnMount) {
      // TODO may cause circular refresh in UI
      backgroundApiProxy.serviceToken.fetchAccountTokens();
    }
  }, [fetchTokensOnMount]);

  const getTokenBalance = useCallback(
    (token: Token | undefined | null = null, defaultValue = ''): string => {
      const balance =
        balances[token?.tokenIdOnNetwork || 'main'] ?? defaultValue;
      return balance as string;
    },
    [balances],
  );

  return {
    nativeToken,
    accountTokensMap,
    accountTokens,
    allTokens,
    prices,
    balances,
    getTokenBalance,
  };
};
