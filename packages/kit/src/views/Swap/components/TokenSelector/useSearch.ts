import { useEffect, useMemo, useState } from 'react';

import { Token } from '@onekeyhq/engine/src/types/token';

import backgroundApiProxy from '../../../../background/instance/backgroundApiProxy';
import { useDebounce } from '../../../../hooks';

export const useSearch = (
  networkId?: string | null,
  accountId?: string | null,
) => {
  const [keyword, setKeyword] = useState('');
  const [loading, setLoading] = useState(false);
  const [tokens, setTokens] = useState<Token[] | undefined>();
  const debouncedKeyword = useDebounce(keyword.trim(), 300);

  useEffect(() => {
    async function main() {
      if (debouncedKeyword.length === 0 || !networkId || !accountId) {
        setTokens(undefined);
        return;
      }
      setLoading(true);
      let result = [];
      try {
        result = await backgroundApiProxy.engine.searchTokens(
          networkId,
          debouncedKeyword,
        );
        setTokens(result);
      } finally {
        setLoading(false);
      }
      backgroundApiProxy.serviceToken.fetchTokenBalance({
        activeAccountId: accountId,
        activeNetworkId: networkId,
        tokenIds: result.map((i) => i.tokenIdOnNetwork),
      });
    }
    main();
  }, [debouncedKeyword, networkId, accountId]);

  const isLoading = useMemo(
    () => keyword !== debouncedKeyword || loading,
    [loading, keyword, debouncedKeyword],
  );

  return useMemo(
    () => ({ isLoading, keyword, setKeyword, tokens, terms: debouncedKeyword }),
    [isLoading, keyword, setKeyword, tokens, debouncedKeyword],
  );
};
