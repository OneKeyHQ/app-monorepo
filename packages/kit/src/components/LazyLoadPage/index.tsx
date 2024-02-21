import { memo } from 'react';

import { Stack } from '@onekeyhq/components';
import LazyLoad from '@onekeyhq/shared/src/lazyLoad';

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
