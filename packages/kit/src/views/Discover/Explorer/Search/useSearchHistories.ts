import { useEffect, useMemo, useState } from 'react';

import Fuse from 'fuse.js';

import { useAppSelector } from '@onekeyhq/kit/src/hooks/redux';
import { WebSiteHistory } from '@onekeyhq/kit/src/store/reducers/discover';

import type { DAppItemType } from '../../type';

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
    {
      name: 'webSite.title',
      weight: 1,
    },
    {
      name: 'webSite.url',
      weight: 0.5,
    },
  ],
};

export type MatchDAppItemType = {
  id: string;
  dapp?: DAppItemType | undefined;
  webSite?: WebSiteHistory | undefined;
  clicks?: number | undefined;
  timestamp?: number | undefined;
};

function searchScore(params: Fuse.FuseResult<MatchDAppItemType>) {
  return (params.score ?? 1) - (params.item.clicks ?? 1) / 100;
}

function searchHistories(
  histories: MatchDAppItemType[],
  terms: string,
): MatchDAppItemType[] {
  const fuse = new Fuse(histories, options);
  const searchResult = fuse.search(terms);

  return searchResult
    .filter((item) => item.score && item.score < 0.9)
    .sort((a, b) => searchScore(a) - searchScore(b))
    .map((item) => item.item);
}

export const useSearchHistories = (terms: string, keyword: string) => {
  const { history, syncData } = useAppSelector((s) => s.discover);

  const [loading, setLoading] = useState(false);

  const allHistories = useMemo(() => {
    const dappHistoryArray: MatchDAppItemType[] = [];

    Object.entries(history).forEach(([key, value]) => {
      const dAppItem = {
        id: key,
        dapp: syncData.increment[key],
        webSite: value.webSite,
        clicks: value?.clicks ?? 0,
        timestamp: value?.timestamp ?? 0,
      };
      if (dAppItem) dappHistoryArray.push(dAppItem);
    });

    return dappHistoryArray.sort(
      (a, b) => (b.timestamp ?? 0) - (a?.timestamp ?? 0),
    );
  }, [history, syncData.increment]);

  useEffect(() => {
    if (terms !== keyword) {
      setLoading(true);
    }
  }, [terms, keyword]);

  const searchedHistories = useMemo(() => {
    if (terms.length === 0) {
      return [];
    }
    setLoading(true);
    try {
      const histories = allHistories;
      return searchHistories(histories, terms);
    } finally {
      setLoading(false);
    }
  }, [allHistories, terms]);

  return {
    loading,
    searchedHistories,
    allHistories,
  };
};
