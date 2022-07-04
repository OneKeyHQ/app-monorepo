import { useEffect, useState } from 'react';

import backgroundApiProxy from '../../../../background/instance/backgroundApiProxy';

import type { Token } from '../../../../store/typings';

export const useSearchTokens = (
  terms: string,
  keyword: string,
  networkId?: string | null,
  accountId?: string | null,
) => {
  const [loading, setLoading] = useState(false);
  const [searchedTokens, setTokens] = useState<Token[]>([]);
  useEffect(() => {
    if (terms !== keyword) {
      setLoading(true);
    }
  }, [terms, keyword]);
  useEffect(() => {
    async function main() {
      if (terms.length === 0 || !networkId || !accountId) {
        return;
      }
      setLoading(true);
      setTokens([]);
      let tokens = [];
      try {
        tokens = await backgroundApiProxy.engine.searchTokens(networkId, terms);
        setTokens(tokens);
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
  }, [terms, networkId, accountId]);
  return {
    loading,
    searchedTokens,
  };
};
