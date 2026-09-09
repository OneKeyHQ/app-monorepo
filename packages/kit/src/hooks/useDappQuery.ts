import { useMemo } from 'react';

import { useRoute } from '@react-navigation/core';

import type { IDappSourceInfo } from '@onekeyhq/shared/types';

interface IBaseQueryInfo {
  $sourceInfo?: IDappSourceInfo;
}

function useDappQuery<T = unknown>() {
  const route = useRoute();
  const query = (route.params as { query: string })?.query ?? '';
  // Memoized on the raw query string rather than re-parsed per render: callers
  // destructure $sourceInfo and friends straight into hook dependency arrays,
  // and a fresh object every render invalidates every one of them. The route
  // carries a _$t stamp, so a genuinely new request changes the string and
  // re-parses.
  return useMemo(() => {
    let queryInfo: IBaseQueryInfo & T = {} as IBaseQueryInfo & T;

    try {
      if (query) {
        queryInfo = JSON.parse(query);
      }
      console.log('useDappQuery: ', queryInfo);
    } catch (_error) {
      console.error(`parse dapp query error: ${query}`);
    }

    return queryInfo;
  }, [query]);
}

export default useDappQuery;
