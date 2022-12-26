import { useCallback, useEffect, useMemo, useState } from 'react';

import { useIsFocused } from '@react-navigation/native';
import BigNumber from 'bignumber.js';
import { isNumber, merge } from 'lodash';

import { getBalanceKey } from '@onekeyhq/engine/src/managers/token';
import type { Token } from '@onekeyhq/engine/src/types/token';

import backgroundApiProxy from '../background/instance/backgroundApiProxy';

import { useActiveWalletAccount } from './redux';
import {
  useAccountTokenLoading,
  useAccountTokens,
  useAccountTokensBalance,
  useNativeToken,
  useNetworkTokens,
} from './useTokens';

export const useManageTokensOfAccount = ({
  pollingInterval = 0,
  fetchTokensOnMount = false,
  accountId,
  networkId,
}: {
  pollingInterval?: number;
  fetchTokensOnMount?: boolean; // fetch tokens with price and balance onMount
  accountId: string;
  networkId: string;
}) => {
  const isFocused = useIsFocused();

  const allTokens: Token[] = useNetworkTokens(networkId);
  const accountTokens: Token[] = useAccountTokens(networkId, accountId);
  const accountTokensLoading = useAccountTokenLoading(networkId, accountId);
  const balances = useAccountTokensBalance(networkId, accountId);
  const nativeToken = useNativeToken(networkId, accountId);
  const [frozenBalance, setFrozenBalance] = useState<
    number | Record<string, number>
  >(0);

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
      backgroundApiProxy.serviceToken.fetchAccountTokensDebounced({
        activeAccountId: accountId,
        activeNetworkId: networkId,
        withBalance: true,
      });
      timer = setInterval(() => {
        backgroundApiProxy.serviceToken.fetchAccountTokensDebounced({
          activeAccountId: accountId,
          activeNetworkId: networkId,
          withBalance: true,
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
      backgroundApiProxy.serviceToken.fetchAccountTokensDebounced({
        activeAccountId: accountId,
        activeNetworkId: networkId,
        withBalance: true,
      });
    }
    // eslint-disable-next-line
  }, []);

  useEffect(() => {
    backgroundApiProxy.engine
      .getFrozenBalance({
        accountId,
        networkId,
      })
      .then((value) => {
        setFrozenBalance(value);
      });
  }, [accountId, networkId]);

  const getTokenBalance = useCallback(
    (
      options: {
        token?: Token | null;
        defaultValue?: string;
        tokenIdOnNetwork?: string;
      } = {},
    ): string => {
      const { token, defaultValue } = merge(
        {
          token: null,
          defaultValue: '',
          tokenIdOnNetwork: '',
        },
        options ?? {},
      );

      const tokenInfo = token as Token | null;
      const key = getBalanceKey(tokenInfo);
      const balance = balances?.[key] ?? defaultValue;
      const frozen = isNumber(frozenBalance)
        ? frozenBalance
        : frozenBalance[key];
      const frozenBN = new BigNumber(frozen ?? 0);
      const balanceBN = new BigNumber(balance);
      const realBalanceBN = balanceBN.minus(frozenBN);
      const realBalance = (
        realBalanceBN.isNegative() ? 0 : realBalanceBN
      ).toFixed();
      return realBalance;
    },
    [balances, frozenBalance],
  );

  return {
    loading: accountTokensLoading,
    nativeToken,
    accountTokens,
    accountTokensMap,
    allTokens,
    balances,
    getTokenBalance,
  };
};

export const useManageTokens = ({
  pollingInterval = 0,
  fetchTokensOnMount = false,
}: {
  pollingInterval?: number;
  fetchTokensOnMount?: boolean;
} = {}) => {
  const { accountId, networkId } = useActiveWalletAccount();
  return useManageTokensOfAccount({
    pollingInterval,
    fetchTokensOnMount,
    accountId,
    networkId,
  });
};
