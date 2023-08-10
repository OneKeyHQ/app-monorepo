import { useMemo } from 'react';

import { useAppSelector } from '@onekeyhq/kit/src/hooks';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

export function useShowBookmark() {
  const isMasOrIOS = platformEnv.isNativeIOS || platformEnv.isMas;
  const showBookmark = useAppSelector((s) => s.discover.showBookmark);
  const hideDiscoverContent = useAppSelector(
    (s) => s.settings.devMode?.hideDiscoverContent,
  );
  return useMemo(() => {
    if (hideDiscoverContent) {
      return false;
    }
    if (!isMasOrIOS) {
      return true;
    }
    return Boolean(showBookmark);
  }, [showBookmark, isMasOrIOS, hideDiscoverContent]);
}

export function useSearchControl() {
  const isMasOrIOS = platformEnv.isNativeIOS || platformEnv.isMas;
  const enableIOSDappSearch = useAppSelector(
    (s) => s.discover.enableIOSDappSearch,
  );
  return useMemo(() => {
    if (!isMasOrIOS) {
      return true;
    }
    return Boolean(enableIOSDappSearch);
  }, [enableIOSDappSearch, isMasOrIOS]);
}
