import { useRoute } from '@react-navigation/core';

import type { IDappSourceInfo } from '@onekeyhq/shared/types';

interface IBaseQueryInfo {
  $sourceInfo?: IDappSourceInfo;
}

// TODO: Add T Type
function useDappQuery<T = unknown>() {
  const route = useRoute();
  const query = (route.params as { query: string })?.query ?? '';
  let queryInfo: IBaseQueryInfo & T = {} as IBaseQueryInfo & T;

  try {
    if (query) {
      queryInfo = JSON.parse(query);
    }
    console.log('useDappQuery: ', queryInfo);
  } catch (error) {
    console.error(`parse dapp query error: ${query}`);
  }

  return queryInfo;
}

export default useDappQuery;
