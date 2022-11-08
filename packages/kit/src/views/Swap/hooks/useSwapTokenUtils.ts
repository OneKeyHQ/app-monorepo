import { useEffect, useMemo, useState } from 'react';

import { Token } from '@onekeyhq/engine/src/types/token';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import {
  useAccountTokensBalance,
  useAppSelector,
  useNetworkTokensPrice,
  useThrottle,
} from '../../../hooks';

export const useTokenSearch = (keyword: string, networkId?: string | null) => {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<Token[]>([]);
  useEffect(() => {
    async function main() {
      if (keyword.length === 0) {
        return;
      }
      setLoading(true);
      setResult([]);
      let tokens: Token[] = [];
      try {
        tokens = await backgroundApiProxy.serviceSwap.searchTokens({
          networkId: networkId ?? undefined,
          keyword,
        });
        setResult(tokens);
      } finally {
        setLoading(false);
      }
    }
    main();
  }, [keyword, networkId]);
  return {
    loading,
    result,
  };
};

export const useCachedPrices = (networkId?: string) => {
  const prices = useNetworkTokensPrice(networkId);
  return useThrottle(prices, 2000);
};

export const useCachedBalances = (networkId?: string, accountId?: string) => {
  const balances = useAccountTokensBalance(networkId, accountId);
  return useThrottle(balances, 2000);
};

export const useTokenBalance = (token?: Token, accountId?: string) => {
  const balances = useCachedBalances(token?.networkId, accountId);
  useEffect(() => {
    if (token && accountId) {
      backgroundApiProxy.serviceToken.fetchTokenBalance({
        activeAccountId: accountId,
        activeNetworkId: token.networkId,
        tokenIds: token.tokenIdOnNetwork ? [token.tokenIdOnNetwork] : [],
      });
    }
  }, [token, accountId]);
  return useMemo(() => {
    if (!token) {
      return undefined;
    }
    return balances[token?.tokenIdOnNetwork || 'main'];
  }, [balances, token]);
};

export const useTokenPrice = (token?: Token) => {
  const prices = useCachedPrices(token?.networkId);
  return useMemo(() => {
    if (!token) {
      return undefined;
    }
    return prices[token.tokenIdOnNetwork || 'main'];
  }, [prices, token]);
};

export function useSwapTokenList(networkId?: string) {
  const tokenList = useAppSelector((s) => s.swapTransactions.tokenList);
  return useMemo(() => {
    if (!tokenList) {
      return [];
    }
    let activeNetworkId = networkId;
    if (!activeNetworkId) {
      activeNetworkId = 'All';
    }
    const data = tokenList.find((item) => item.networkId === activeNetworkId);
    return data?.tokens ?? [];
  }, [tokenList, networkId]);
}
