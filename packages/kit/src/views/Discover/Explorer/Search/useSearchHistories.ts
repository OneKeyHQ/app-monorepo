import { useEffect, useState } from 'react';

import { useAppSelector } from '@onekeyhq/kit/src/hooks/redux';

import type { DAppItemType } from '../../type';

export const useSearchHistories = (terms: string, keyword: string) => {
  const discover = useAppSelector((s) => s.discover);

  const [loading, setLoading] = useState(false);
  const [searchedHistories, setHistories] = useState<DAppItemType[]>([]);
  const [allHistories, setAllHistories] = useState<DAppItemType[]>([]);

  useEffect(() => {
    if (terms !== keyword) {
      setLoading(true);
    }
  }, [terms, keyword]);

  useEffect(() => {
    function main() {
      if (terms.length === 0) {
        setAllHistories(discover.history);
        return;
      }
      setLoading(true);
      setHistories([]);
      try {
        setAllHistories(discover.history);
        const histories = discover.history;
        setHistories(
          histories.filter(
            (history) =>
              history.name.toLowerCase().includes(terms.trim().toLowerCase()) ||
              history.url.toLowerCase().includes(terms.trim().toLowerCase()) ||
              history.subtitle
                .toLowerCase()
                .includes(terms.trim().toLowerCase()) ||
              history.description
                .toLowerCase()
                .includes(terms.trim().toLowerCase()),
          ),
        );
      } finally {
        setLoading(false);
      }
    }
    main();
  }, [discover.history, terms]);
  return {
    loading,
    searchedHistories,
    allHistories,
  };
};
