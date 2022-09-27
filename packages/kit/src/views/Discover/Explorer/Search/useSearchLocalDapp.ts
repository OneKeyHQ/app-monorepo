import { useEffect, useMemo, useState } from 'react';

import Fuse from 'fuse.js';

import { useAppSelector } from '@onekeyhq/kit/src/hooks/redux';

import { MatchDAppItemType } from '../explorerUtils';

const options = {
  includeScore: true,
  threshold: 0.4,
  keys: [
    {
      name: 'dapp.name',
      weight: 1,
    },
    {
      name: 'dapp.url',
      weight: 0.5,
    },
    {
      name: 'dapp.subtitle',
      weight: 0.3,
    },
  ],
};

function searchScore(params: Fuse.FuseResult<MatchDAppItemType>) {
  return (params.score ?? 1) - (params.item.clicks ?? 1) / 100;
}

function searchDapps(
  dapps: MatchDAppItemType[],
  terms: string,
): MatchDAppItemType[] {
  const fuse = new Fuse(dapps, options);
  const searchResult = fuse.search(terms);

  return searchResult
    .filter((item) => item.score && item.score < 0.9)
    .sort((a, b) => searchScore(a) - searchScore(b))
    .map((item) => item.item);
}

export const useSearchLocalDapp = (terms: string, keyword: string) => {
  const { history, syncData } = useAppSelector((s) => s.discover);

  const [loading, setLoading] = useState(false);

  const allDapps = useMemo(() => {
    const dappArray: MatchDAppItemType[] = [];

    Object.entries(syncData.increment).forEach(([key, value]) => {
      const isCorrectDApp =
        value && value.status?.toLowerCase() === 'listed' && !!value.url;

      if (isCorrectDApp) {
        const dappHistory = history[key];
        dappArray.push({
          id: key,
          dapp: value,
          webSite: undefined,
          clicks: dappHistory?.clicks ?? 0,
          timestamp: dappHistory?.timestamp ?? 0,
        });
      }
    });

    return dappArray.sort((a, b) => (b.timestamp ?? 0) - (a?.timestamp ?? 0));
  }, [history, syncData.increment]);

  useEffect(() => {
    if (terms !== keyword) {
      setLoading(true);
    }
  }, [terms, keyword]);

  const searchedDapps = useMemo(() => {
    if (terms.length === 0) {
      setLoading(false);
      return [];
    }
    setLoading(true);
    try {
      return searchDapps(allDapps, terms);
    } finally {
      setLoading(false);
    }
  }, [allDapps, terms]);

  return {
    loading,
    searchedDapps,
  };
};
