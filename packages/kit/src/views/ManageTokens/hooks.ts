import { useEffect, useState } from 'react';

import engine from '../../engine/EngineProvider';

import type { ValuedToken } from '../../store/reducers/general';

export const useSearchTokens = (
  terms: string,
  keyword: string,
  networkid?: string,
) => {
  const [loading, setLoading] = useState(false);
  const [searchedTokens, setTokens] = useState<ValuedToken[]>([]);
  useEffect(() => {
    if (terms !== keyword) {
      setLoading(true);
    }
  }, [terms, keyword]);
  useEffect(() => {
    async function main() {
      if (terms.length === 0 || !networkid) {
        return;
      }
      setLoading(true);
      setTokens([]);
      try {
        const tokens = await engine.searchTokens(networkid, terms);
        setTokens(tokens);
      } finally {
        setLoading(false);
      }
    }
    main();
  }, [terms, networkid]);
  return {
    loading,
    searchedTokens,
  };
};
