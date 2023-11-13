import { useMemo } from 'react';

import {
  browserHistoryAtom,
  useAtomBrowserHistory,
} from '../store/contextBrowserHistory';

function useBrowserHistory() {
  const [browserHistory] = useAtomBrowserHistory(browserHistoryAtom);
  return useMemo(
    () => ({
      browserHistory,
    }),
    [browserHistory],
  );
}

export default useBrowserHistory;
