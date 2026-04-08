import { useCallback, useRef } from 'react';

import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';

import { usePromiseResult } from '../../../hooks/usePromiseResult';

export const useBlockRegion = () => {
  const shouldRefreshConnectionRef = useRef(false);
  const {
    isLoading: isFetchingBlockResult,
    run: refreshBlockResult,
    result: blockResult,
  } = usePromiseResult(
    async () => {
      const blockData = shouldRefreshConnectionRef.current
        ? await backgroundApiProxy.serviceStaking.refreshBlockRegion()
        : await backgroundApiProxy.serviceStaking.getBlockRegion();
      return { blockData };
    },
    [],
    {
      watchLoading: true,
      revalidateOnFocus: true,
    },
  );

  const handleRefreshBlockResult = useCallback(async () => {
    shouldRefreshConnectionRef.current = true;
    try {
      await refreshBlockResult();
    } finally {
      shouldRefreshConnectionRef.current = false;
    }
  }, [refreshBlockResult]);

  return {
    isFetchingBlockResult,
    refreshBlockResult: handleRefreshBlockResult,
    blockResult,
  };
};
