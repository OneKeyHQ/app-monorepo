import { useMemo } from 'react';

import {
  browserBookmarkAtom,
  useAtomBrowserBookmark,
} from '../store/contextBrowserBookmark';

function useBrowserBookmark() {
  const [browserBookmark] = useAtomBrowserBookmark(browserBookmarkAtom);
  return useMemo(
    () => ({
      browserBookmark,
    }),
    [browserBookmark],
  );
}

export default useBrowserBookmark;
