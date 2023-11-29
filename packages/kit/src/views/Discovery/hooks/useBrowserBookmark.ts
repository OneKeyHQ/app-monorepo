import { useMemo } from 'react';

import { useBrowserBookmarkAtom } from '@onekeyhq/kit/src/states/jotai/contexts/discovery';

function useBrowserBookmark() {
  const [browserBookmark] = useBrowserBookmarkAtom();
  return useMemo(
    () => ({
      browserBookmark,
    }),
    [browserBookmark],
  );
}

export default useBrowserBookmark;
