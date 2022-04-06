import { useEffect, useState } from 'react';

import type { HistoryItem } from './types';

const Histories = [
  {
    logoURI: 'https://picsum.photos/id/237/200/200',
    title: 'OneKey',
    url: 'https://onekey.one',
  },
  {
    logoURI: 'https://picsum.photos/id/237/200/200',
    title: 'Baidu',
    url: 'https://www.baidu.com/',
  },
  {
    logoURI: 'https://picsum.photos/id/237/200/200',
    title: 'Google',
    url: 'https://www.Google.com',
  },
  {
    logoURI: 'https://picsum.photos/id/237/200/200',
    title: 'OneKey',
    url: 'https://onekey.one',
  },
  {
    logoURI: 'https://picsum.photos/id/237/200/200',
    title: 'Baidu',
    url: 'https://www.baidu.com/',
  },
  {
    logoURI: 'https://picsum.photos/id/237/200/200',
    title: 'Google',
    url: 'https://www.Google.com',
  },
  {
    logoURI: 'https://picsum.photos/id/237/200/200',
    title: 'OneKey',
    url: 'https://onekey.one',
  },
  {
    logoURI: 'https://picsum.photos/id/237/200/200',
    title: 'Baidu',
    url: 'https://www.baidu.com/',
  },
  {
    logoURI: 'https://picsum.photos/id/237/200/200',
    title: 'Google',
    url: 'https://www.Google.com',
  },
];

export const useSearchHistories = (terms: string, keyword: string) => {
  const [loading, setLoading] = useState(false);
  const [searchedHistories, setHistories] = useState<HistoryItem[]>([]);
  const [allHistories, setAllHistories] = useState<HistoryItem[]>([]);

  useEffect(() => {
    if (terms !== keyword) {
      setLoading(true);
    }
  }, [terms, keyword]);

  useEffect(() => {
    function main() {
      if (terms.length === 0) {
        setAllHistories(Histories);
        return;
      }
      setLoading(true);
      setHistories([]);
      try {
        const histories = Histories;
        setAllHistories(Histories);
        setHistories(
          histories.filter(
            (history) =>
              history.title
                .toLowerCase()
                .includes(terms.trim().toLowerCase()) ||
              history.url.toLowerCase().includes(terms.trim().toLowerCase()),
          ),
        );
      } finally {
        setLoading(false);
      }
    }
    main();
  }, [terms]);
  return {
    loading,
    searchedHistories,
    allHistories,
  };
};
