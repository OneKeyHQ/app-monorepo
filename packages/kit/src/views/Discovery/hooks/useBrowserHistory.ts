import { useMemo } from 'react';

import { useBrowserHistoryAtom } from '@onekeyhq/kit/src/states/jotai/contexts/discovery';

function useBrowserHistory() {
  const [browserHistory] = useBrowserHistoryAtom();
  return useMemo(
    () => ({
      browserHistory,
    }),
    [browserHistory],
  );
}

export default useBrowserHistory;
