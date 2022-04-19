import { useEffect, useState } from 'react';

import backgroundApiProxy from '../../../../background/instance/backgroundApiProxy';
import { setAccountTokensBalances } from '../../../../store/reducers/tokens';

import type { Token } from '../../../../store/typings';

export const useSearchTokens = (
  terms: string,
  keyword: string,
  networkid?: string | null,
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
      if (terms.length === 0 || !networkid || !accountId) {
        return;
      }
      setLoading(true);
      setTokens([]);
      let tokens = [];
      try {
        tokens = await backgroundApiProxy.engine.searchTokens(networkid, terms);
        setTokens(tokens);
      } finally {
        setLoading(false);
      }
      const balances = await backgroundApiProxy.engine.getAccountBalance(
        accountId,
        networkid,
        tokens.map((i) => i.tokenIdOnNetwork),
      );
      backgroundApiProxy.dispatch(
        setAccountTokensBalances({
          activeAccountId: accountId,
          activeNetworkId: networkid,
          tokensBalance: balances,
        }),
      );
    }
    main();
  }, [terms, networkid, accountId]);
  return {
    loading,
    searchedTokens,
  };
};
