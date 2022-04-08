import { useRoute } from '@react-navigation/core';

import { IDappCallParams } from '../background/IBackgroundApi';

// TODO rename useDappQuery
function useDappParams() {
  const route = useRoute();
  const query = (route.params as { query?: string })?.query;
  let queryInfo: {
    sourceInfo?: IDappCallParams;
  } = {};
  if (query) {
    try {
      queryInfo = JSON.parse(query);
    } catch (error) {
      console.error(`parse dapp query error: ${query}`);
    }
  }
  return queryInfo;
}

export default useDappParams;
