import { useMemo } from 'react';

import { useMedia } from '@onekeyhq/components';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

export const useIsGtMdNonNative = () => {
  const { gtMd } = useMedia();
  return useMemo(() => gtMd && !platformEnv.isNative, [gtMd]);
};
