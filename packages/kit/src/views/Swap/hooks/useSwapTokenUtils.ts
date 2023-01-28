import { useEffect, useMemo, useRef, useState } from 'react';

import type { Token } from '@onekeyhq/engine/src/types/token';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import {
  useAccountTokens,
  useAccountTokensBalance,
  useAppSelector,
  useNetworkTokensPrice,
  useThrottle,
} from '../../../hooks';
import { useSimpleTokenPriceValue } from '../../../hooks/useManegeTokenPrice';
import { formatAmount } from '../utils';

type TokenSearchRef = {
  keyword: string;
  count: number;
  networkId?: string | null;
};

export const useTokenSearch = (keyword: string, networkId?: string | null) => {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<Token[] | undefined>();
  const ref = useRef<TokenSearchRef>({ keyword: '', count: 0 });

  useEffect(() => {
    ref.current.keyword = keyword;
    ref.current.networkId = networkId;
    async function search(pKeyword: string, pNetworkId?: string | null) {
      if (pKeyword.length === 0) {
        setResult(undefined);
        return;
      }
      setLoading(true);
      setResult([]);
      let tokens: Token[] = [];
      try {
        ref.current.count += 1;
        tokens = await backgroundApiProxy.serviceSwap.searchTokens({
          networkId: pNetworkId ?? undefined,
          keyword,
        });
        if (
          pKeyword === ref.current.keyword &&
          pNetworkId === ref.current.networkId
        ) {
          setResult(tokens);
        }
      } finally {
        ref.current.count -= 1;
        if (ref.current.count === 0) {
          setLoading(false);
        }
      }
    }
    search(keyword, networkId);
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

export const useTokenBalanceSimple = (token?: Token, accountId?: string) => {
  const balances = useCachedBalances(token?.networkId, accountId);
  return useMemo(() => {
    if (!token) {
      return undefined;
    }
    return balances[token?.tokenIdOnNetwork || 'main'];
  }, [balances, token]);
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
  // const prices = useCachedPrices(token?.networkId);
  const price = useSimpleTokenPriceValue({
    networkId: token?.networkId,
    contractAdress: token?.tokenIdOnNetwork,
  });
  return useMemo(() => {
    if (!token) {
      return undefined;
    }
    return price;
  }, [price, token]);
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

export function useSwapAccountTokens(networkId?: string, accountId?: string) {
  const presetTokens = useSwapTokenList(networkId);
  const accountTokens = useAccountTokens(networkId, accountId);
  const balances = useCachedBalances(networkId, accountId);

  return useMemo(() => {
    const tokens = [...presetTokens, ...accountTokens];
    const set = new Set();
    const getKey = (token: Token) =>
      `${token.networkId}${token.tokenIdOnNetwork}`;
    const items = tokens.filter((token) => {
      if (set.has(getKey(token))) {
        return false;
      }
      set.add(getKey(token));
      return true;
    });

    const balanceIsOk = (address: string) => {
      const key = address || 'main';
      return Boolean(
        balances[key] && Number(formatAmount(balances[key], 6)) > 0,
      );
    };

    if (!balances) {
      return items;
    }
    const a = items.filter((o) => balanceIsOk(o.tokenIdOnNetwork));
    const b = items.filter((o) => !balanceIsOk(o.tokenIdOnNetwork));

    return a.concat(b);
  }, [presetTokens, accountTokens, balances]);
}
