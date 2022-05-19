import { useEffect, useMemo, useState } from 'react';

import Fuse from 'fuse.js';

import { MoonpayTokenType } from '../types';

const options = {
  keys: [
    {
      name: 'name',
      weight: 1,
    },
  ],
};

// function searchScore(params: Fuse.FuseResult<MoonpayTokenType>) {
//   return (params.score ?? 1) - (params.item.clicks ?? 1) / 100;
// }

function searchTokens(
  tokens: MoonpayTokenType[],
  terms: string,
): MoonpayTokenType[] {
  const fuse = new Fuse(tokens, options);
  const searchResult = fuse.search(terms);
  return searchResult.map((item) => item.item);
  // return searchResult
  //   .filter((item) => item.score && item.score < 0.9)
  //   .sort((a, b) => searchScore(a) - searchScore(b))
  //   .map((item) => item.item);
}

export const useSearchTokens = (
  allTokens: MoonpayTokenType[],
  terms: string,
  keyword: string,
) => {
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (terms !== keyword) {
      setLoading(true);
    }
  }, [terms, keyword]);

  const searchedTokens = useMemo(() => {
    if (terms.length === 0) {
      setLoading(false);
      return [];
    }
    setLoading(true);
    try {
      return searchTokens(allTokens, terms);
    } finally {
      setLoading(false);
    }
  }, [allTokens, terms]);

  return {
    loading,
    searchedTokens,
  };
};
