import { useMemo } from 'react';

import earnUtils from '@onekeyhq/shared/src/utils/earnUtils';

export function useIsPendleProvider(providerName: string): boolean {
  return useMemo(
    () => earnUtils.isPendleProvider({ providerName }),
    [providerName],
  );
}
