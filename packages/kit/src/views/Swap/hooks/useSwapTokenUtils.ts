import { useEffect, useMemo, useRef, useState } from 'react';

import { isAccountCompatibleWithNetwork } from '@onekeyhq/engine/src/managers/account';
import { getBalanceKey } from '@onekeyhq/engine/src/managers/token';
import type { Token } from '@onekeyhq/engine/src/types/token';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import { useAccountTokensBalance, useThrottle } from '../../../hooks';
import { useSimpleTokenPriceValue } from '../../../hooks/useManegeTokenPrice';

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
    return balances[getBalanceKey(token)];
  }, [balances, token]);
};

export const useTokenBalance = (token?: Token, accountId?: string) => {
  const balances = useCachedBalances(token?.networkId, accountId);
  useEffect(() => {
    if (token && accountId) {
      if (isAccountCompatibleWithNetwork(accountId, token.networkId)) {
        backgroundApiProxy.serviceToken.getAccountTokenBalance({
          accountId,
          networkId: token.networkId,
          tokenIds: token.tokenIdOnNetwork ? [token.tokenIdOnNetwork] : [],
        });
      }
    }
  }, [token, accountId]);
  return useMemo(() => {
    if (!token) {
      return undefined;
    }
    return balances[getBalanceKey(token)]?.balance;
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
