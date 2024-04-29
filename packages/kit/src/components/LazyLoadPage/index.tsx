import { memo } from 'react';

import { Stack } from '@onekeyhq/components';
import LazyLoad from '@onekeyhq/shared/src/lazyLoad';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

export const LazyLoadPage = (
  factory: () => Promise<{ default: any }>,
  delayMs?: number,
) => {
  const LazyLoadComponent = LazyLoad(factory, delayMs);
  function LazyLoadPageContainer(props: any) {
    return (
      <Stack flex={1} bg="$bgApp">
        <LazyLoadComponent {...props} />
      </Stack>
    );
  }
  return memo(LazyLoadPageContainer);
};

// prevent useEffect triggers when tab loaded on Native
export const LazyTabHomePage = (
  factory: () => Promise<{ default: any }>,
) => {
  // prevent hooks run 
  return LazyLoadPage(factory, platformEnv.isNative ?  1 : undefined)
};
