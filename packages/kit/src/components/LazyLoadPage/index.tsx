import { memo } from 'react';

import { Stack } from '@onekeyhq/components';
import LazyLoad from '@onekeyhq/shared/src/lazyLoad';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

export const LazyLoadPage = (
  factory: () => Promise<{ default: any }>,
  delayMs?: number,
  unStyle?: boolean,
  fallback?: React.ReactNode,
) => {
  const LazyLoadComponent = LazyLoad(factory, delayMs, fallback);
  function LazyLoadPageContainer(props: any) {
    if (unStyle) {
      return <LazyLoadComponent {...props} />;
    }

    return (
      <Stack flex={1} className="LazyLoadPageContainer" bg="$bgApp">
        <LazyLoadComponent {...props} />
      </Stack>
    );
  }
  return memo(LazyLoadPageContainer);
};

// prevent useEffect triggers when tab loaded on Native
export const LazyLoadRootTabPage = (factory: () => Promise<{ default: any }>) =>
  // prevent hooks run
  LazyLoadPage(factory, platformEnv.isNative ? 1 : undefined);
