import { useEffect, useMemo, useState } from 'react';

import Fuse from 'fuse.js';

import platformEnv from '@onekeyhq/shared/src/platformEnv';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import { useAppSelector } from '../../../hooks';
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
  const [allDapps, setAllDapps] = useState<DAppItemType[]>([]);

  const enableIOSDappSearch = useAppSelector(
    (s) => s.discover.enableIOSDappSearch,
  );

  useEffect(() => {
    async function main() {
      if (terms) {
        const item = await backgroundApiProxy.serviceDiscover.searchDapps(
          terms,
        );
        setAllDapps(item);
      } else {
        setAllDapps([]);
      }
    }
    main();
  }, [terms, keyword]);

  const searchedDapps = useMemo(() => {
    if (terms.length === 0) {
      setLoading(false);
      return [];
    }
    setLoading(true);
    try {
      let items = allDapps;
      if (
        (platformEnv.isNativeIOS || platformEnv.isMas) &&
        !enableIOSDappSearch
      ) {
        items = [];
      }
      return searchDapps(items, terms);
    } finally {
      setLoading(false);
    }
  }, [allDapps, terms, enableIOSDappSearch]);

  return {
    loading,
    searchedDapps: searchedDapps.map((item) => ({ id: item._id, dapp: item })),
  };
};
