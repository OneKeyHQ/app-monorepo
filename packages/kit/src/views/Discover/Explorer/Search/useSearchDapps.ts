import { useEffect, useState } from 'react';

import type { HistoryItem } from './types';

const allDapps = [
  {
    logoURI: 'https://picsum.photos/id/237/200/200',
    title: 'OneKey',
    url: 'https://onekey.one',
  },
  {
    logoURI: 'https://picsum.photos/id/237/200/200',
    title: 'DYDX',
    url: 'https://dydx.exchange/',
  },
  {
    logoURI: 'https://picsum.photos/id/237/200/200',
    title: 'Sushiswap',
    url: 'https://sushiswapclassic.org',
  },
  {
    logoURI: 'https://picsum.photos/id/237/200/200',
    title: 'Label',
    url: 'https://dapp.com/',
  },
  {
    logoURI: 'https://picsum.photos/id/237/200/200',
    title: 'NBA Top Shot',
    url: 'https://nbatopshot.com/',
  },
];

export const useSearchDapps = (terms: string, keyword: string) => {
  const [loading, setLoading] = useState(false);
  const [searchedDapps, setDapps] = useState<HistoryItem[]>([]);
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
      setDapps([]);
      try {
        const dapps = allDapps;
        setDapps(
          dapps.filter(
            (dapp) =>
              dapp.title.toLowerCase().includes(terms.trim().toLowerCase()) ||
              dapp.url.toLowerCase().includes(terms.trim().toLowerCase()),
          ),
        );
      } finally {
        setLoading(false);
      }
    }
    main();
  }, [terms]);
  return {
    feeInfoLoading: loading,
    searchedDapps,
  };
};
