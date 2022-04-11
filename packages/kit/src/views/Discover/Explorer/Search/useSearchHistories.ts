import { useEffect, useState } from 'react';

import { useAppSelector } from '@onekeyhq/kit/src/hooks/redux';

import type { DAppItemType } from '../../type';

export const useSearchHistories = (terms: string, keyword: string) => {
  const { history, syncData } = useAppSelector((s) => s.discover);

  const [loading, setLoading] = useState(false);
  const [searchedHistories, setHistories] = useState<DAppItemType[]>([]);
  const [allHistories, setAllHistories] = useState<DAppItemType[]>([]);

  useEffect(() => {
    const dappHistoryArray: DAppItemType[] = [];

    Object.entries(history).forEach(([key]) => {
      const dAppItem = syncData.increment[key];

      if (dAppItem) dappHistoryArray.push(dAppItem);
    });

    setAllHistories(
      dappHistoryArray.sort(
        (a, b) => (history[b.id] ?? 0) - (history[a.id] ?? 0),
      ),
    );
  }, [history, syncData.increment]);

  useEffect(() => {
    if (terms !== keyword) {
      setLoading(true);
    }
  }, [terms, keyword]);

  useEffect(() => {
    function main() {
      if (terms.length === 0) {
        return;
      }
      setLoading(true);
      setHistories([]);
      try {
        const histories = allHistories;
        setHistories(
          histories.filter(
            (_history) =>
              _history.name
                .toLowerCase()
                .includes(terms.trim().toLowerCase()) ||
              _history.url.toLowerCase().includes(terms.trim().toLowerCase()) ||
              _history.subtitle
                .toLowerCase()
                .includes(terms.trim().toLowerCase()) ||
              _history.description
                .toLowerCase()
                .includes(terms.trim().toLowerCase()),
          ),
        );
      } finally {
        setLoading(false);
      }
    }
    main();
  }, [allHistories, history, terms]);
  return {
    loading,
    searchedHistories,
    allHistories,
  };
};
