import { useEffect, useMemo, useState } from 'react';

import { Token } from '@onekeyhq/engine/src/types/token';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import { useAccountTokensBalance, useNetworkTokensPrice } from '../../../hooks';

export const useTokenSearch = (
  keyword: string,
  networkId?: string | null,
  accountId?: string | null,
) => {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<Token[]>([]);
  useEffect(() => {
    async function main() {
      if (keyword.length === 0 || !networkId || !accountId) {
        return;
      }
      setLoading(true);
      setResult([]);
      let tokens = [];
      try {
        tokens = await backgroundApiProxy.engine.searchTokens(
          networkId,
          keyword,
        );
        setResult(tokens);
      } finally {
        setLoading(false);
      }
      backgroundApiProxy.serviceToken.fetchTokenBalance({
        activeAccountId: accountId,
        activeNetworkId: networkId,
        tokenIds: tokens.map((i) => i.tokenIdOnNetwork),
      });
    }
    main();
  }, [keyword, networkId, accountId]);
  return {
    loading,
    result,
  };
};

export const useCachedPrices = (networkId?: string): Record<string, string> => {
  const prices = useNetworkTokensPrice(networkId ?? '');
  const data = JSON.stringify(prices);
  return useMemo(() => {
    try {
      return JSON.parse(data) as Record<string, string>;
    } catch {
      return {};
    }
  }, [data]);
};

export const useCachedBalances = (
  networkId?: string,
  accountId?: string,
): Record<string, string> => {
  const balances = useAccountTokensBalance(networkId ?? '', accountId ?? '');
  const data = JSON.stringify(balances);
  return useMemo(() => {
    try {
      return JSON.parse(data) as Record<string, string>;
    } catch {
      return {};
    }
  }, [data]);
};
