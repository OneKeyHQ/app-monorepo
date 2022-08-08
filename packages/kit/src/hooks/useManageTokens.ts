import { useCallback, useEffect, useMemo } from 'react';

import { useIsFocused } from '@react-navigation/native';
import { merge } from 'lodash';

import { Token } from '@onekeyhq/engine/src/types/token';

import backgroundApiProxy from '../background/instance/backgroundApiProxy';

import { useActiveWalletAccount } from './redux';
import {
  useAccountTokenLoading,
  useAccountTokens,
  useAccountTokensBalance,
  useNativeToken,
  useNetworkTokens,
  useNetworkTokensChart,
  useNetworkTokensPrice,
} from './useTokens';

export const useManageTokens = ({
  pollingInterval = 0,
  fetchTokensOnMount = false,
}: {
  pollingInterval?: number;
  fetchTokensOnMount?: boolean;
} = {}) => {
  const isFocused = useIsFocused();
  const { accountId, networkId } = useActiveWalletAccount();
  const allTokens: Token[] = useNetworkTokens(networkId);
  const accountTokens: Token[] = useAccountTokens(networkId, accountId);
  const accountTokensLoading = useAccountTokenLoading(networkId, accountId);
  const balances = useAccountTokensBalance(networkId, accountId);
  const prices = useNetworkTokensPrice(networkId);
  const charts = useNetworkTokensChart(networkId);
  const nativeToken = useNativeToken(networkId, accountId);

  const accountTokensMap = useMemo(() => {
    const map = new Map<string, Token>();
    accountTokens.forEach((token) => {
      if (token.tokenIdOnNetwork) {
        map.set(token.tokenIdOnNetwork, token);
      }
    });
    return map;
  }, [accountTokens]);

  useEffect(() => {
    let timer: ReturnType<typeof setInterval> | undefined;
    if (pollingInterval && isFocused && accountId && networkId) {
      // TODO may cause circular refresh in UI
      backgroundApiProxy.serviceToken.fetchAccountTokens({
        activeAccountId: accountId,
        activeNetworkId: networkId,
        withBalance: true,
        withPrice: true,
      });
      timer = setInterval(() => {
        backgroundApiProxy.serviceToken.fetchAccountTokens({
          activeAccountId: accountId,
          activeNetworkId: networkId,
          withBalance: true,
          withPrice: true,
        });
      }, pollingInterval);
    }
    return () => {
      if (timer) {
        clearInterval(timer);
      }
    };
  }, [isFocused, pollingInterval, accountId, networkId]);

  useEffect(() => {
    if (fetchTokensOnMount && accountId && networkId) {
      // TODO may cause circular refresh in UI
      backgroundApiProxy.serviceToken.fetchAccountTokens({
        activeAccountId: accountId,
        activeNetworkId: networkId,
        withBalance: true,
        withPrice: true,
      });
    }
    // eslint-disable-next-line
  }, []);

  const getTokenBalance = useCallback(
    (
      options: {
        token?: Token | null;
        defaultValue?: string;
        tokenIdOnNetwork?: string;
      } = {},
    ): string => {
      const { token, defaultValue, tokenIdOnNetwork } = merge(
        {
          token: null,
          defaultValue: '',
          tokenIdOnNetwork: '',
        },
        options ?? {},
      );
      const tokenInfo = token as Token | null;
      const key = tokenIdOnNetwork || tokenInfo?.tokenIdOnNetwork || 'main';
      const balance = balances?.[key] ?? defaultValue;
      return balance;
    },
    [balances],
  );

  const getTokenPrice = useCallback(
    (options: {
      token?: Token | null;
      defaultValue?: string;
      tokenIdOnNetwork?: string;
    }) => {
      const { token, defaultValue, tokenIdOnNetwork } = merge(
        {
          token: null,
          defaultValue: '',
          tokenIdOnNetwork: '',
        },
        options ?? {},
      );
      const tokenInfo = token as Token | null;
      const key = tokenIdOnNetwork || tokenInfo?.tokenIdOnNetwork || 'main';
      const priceValue = prices?.[key] ?? defaultValue;
      return priceValue;
    },
    [prices],
  );

  return {
    loading: accountTokensLoading,
    nativeToken,
    accountTokens,
    accountTokensMap,
    allTokens,
    prices,
    balances,
    charts,
    getTokenBalance,
    getTokenPrice,
  };
};
