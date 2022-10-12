import { useEffect, useMemo, useState } from 'react';

import { useAllDapps } from '.';

import Fuse from 'fuse.js';

import { MatchDAppItemType } from '../Explorer/explorerUtils';
import { DAppItemType } from '../type';

const options = {
  includeScore: true,
  threshold: 0.4,
  keys: [
    {
      name: 'name',
      weight: 1,
    },
    {
      name: 'url',
      weight: 0.5,
    },
    {
      name: 'subtitle',
      weight: 0.3,
    },
  ],
};

function searchDapps(dapps: DAppItemType[], terms: string): DAppItemType[] {
  const fuse = new Fuse(dapps, options);
  const searchResult = fuse.search(terms);
  return searchResult
    .filter((item) => item.score && item.score < 0.9)
    .map((item) => item.item);
}

export const useSearchLocalDapp = (
  terms: string,
  keyword: string,
): { loading: boolean; searchedDapps: MatchDAppItemType[] } => {
  const [loading, setLoading] = useState(false);
  const allDapps = useAllDapps();

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
    searchedDapps: searchedDapps.map((item) => ({ id: item._id, dapp: item })),
  };
};
