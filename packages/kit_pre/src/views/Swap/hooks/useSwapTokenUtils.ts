import { useEffect, useMemo, useRef, useState } from 'react';

import { isAccountCompatibleWithNetwork } from '@onekeyhq/engine/src/managers/account';
import { getBalanceKey } from '@onekeyhq/engine/src/managers/token';
import type { Token } from '@onekeyhq/engine/src/types/token';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import {
  useAccountTokensBalance,
  useThrottle,
  useTokenBalanceWithoutFrozen,
} from '../../../hooks';
import { useSimpleTokenPriceValue } from '../../../hooks/useTokens';
import { appSelector } from '../../../store';

type TokenSearchRef = {
  keyword: string;
  count: number;
  networkId?: string | null;
};

function searchPrepare(
  keyword: string,
  networkId?: string | null,
): {
  combined: boolean;
  symbol: string;
  networkName: string;
} {
  if (networkId) {
    return { combined: false, symbol: '', networkName: '' };
  }
  const segments = keyword.split(' ').filter((o) => Boolean(o));
  if (segments.length === 2) {
    return { combined: true, symbol: segments[0], networkName: segments[1] };
  }
  return { combined: false, symbol: '', networkName: '' };
}

export const useTokenSearch = (keyword: string, networkId?: string | null) => {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<Token[] | undefined>();
  const ref = useRef<TokenSearchRef>({ keyword: '', count: 0 });

  useEffect(() => {
    ref.current.keyword = keyword;
    ref.current.networkId = networkId;

    async function search(
      keywordToSearch: string,
      networkIdToSearch?: string | null,
    ) {
      if (keywordToSearch.length === 0) {
        setResult(undefined);
        return;
      }
      setLoading(true);
      setResult([]);
      let tokens: Token[] = [];

      try {
        ref.current.count += 1;
        const prepare = searchPrepare(keywordToSearch, networkIdToSearch);
        if (prepare.combined) {
          tokens = await backgroundApiProxy.serviceSwap.searchTokens({
            keyword: prepare.symbol,
          });
          const networks = appSelector((s) => s.runtime.networks);
          const matchedNetworkIds = networks
            .filter((o) =>
              o.name.toLowerCase().includes(prepare.networkName.toLowerCase()),
            )
            .map((i) => i.id);

          const networksSet = new Set(matchedNetworkIds);
          tokens = tokens.filter((o) => networksSet.has(o.networkId));
          if (
            keywordToSearch === ref.current.keyword &&
            networkIdToSearch === ref.current.networkId
          ) {
            setResult(tokens);
          }
        } else {
          tokens = await backgroundApiProxy.serviceSwap.searchTokens({
            networkId: networkIdToSearch ?? undefined,
            keyword,
          });
          if (
            keywordToSearch === ref.current.keyword &&
            networkIdToSearch === ref.current.networkId
          ) {
            setResult(tokens);
          }
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
  const balance = useTokenBalanceWithoutFrozen({
    networkId: token?.networkId ?? '',
    accountId: accountId ?? '',
    token,
  });
  useEffect(() => {
    if (token && accountId) {
      if (isAccountCompatibleWithNetwork(accountId, token.networkId)) {
        backgroundApiProxy.serviceToken.fetchAndSaveAccountTokenBalance({
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
    return balance;
  }, [balance, token]);
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
