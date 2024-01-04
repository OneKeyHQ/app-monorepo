import { useRoute } from '@react-navigation/core';

import type { IDappSourceInfo } from '@onekeyhq/shared/types';

// TODO: Add T Type
function useDappQuery() {
  const route = useRoute();
  const query = (route.params as { query: string })?.query ?? '';
  let queryInfo: {
    $sourceInfo?: IDappSourceInfo;
  } = {};

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
