import { useRoute } from '@react-navigation/core';

import type { IDappSourceInfo } from '@onekeyhq/shared/types';

interface IBaseQueryInfo {
  $sourceInfo?: IDappSourceInfo;
}

function useDappQuery<T = unknown>() {
  const route = useRoute();
  const query = (route.params as { query: string })?.query ?? '';
  let queryInfo: IBaseQueryInfo & T = {} as IBaseQueryInfo & T;

  try {
    if (query) {
      queryInfo = JSON.parse(query);
    }
    // Query parsed successfully
  } catch (error) {
    // Error handling for query parsing
  }

  return queryInfo;
}

export default useDappQuery;
