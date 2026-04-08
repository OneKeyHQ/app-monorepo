import { useCallback, useState } from 'react';

import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';

import { usePromiseResult } from '../../../hooks/usePromiseResult';

export const useBlockRegion = () => {
  const {
    isLoading: isFetchingBlockResultBase,
    setResult: setBlockResult,
    result: blockResult,
  } = usePromiseResult(
    async () => {
      const blockData =
        await backgroundApiProxy.serviceStaking.getBlockRegion();
      return { blockData };
    },
    [],
    {
      watchLoading: true,
      revalidateOnFocus: true,
    },
  );
  const [isRefreshingBlockResult, setIsRefreshingBlockResult] = useState(false);

  const handleRefreshBlockResult = useCallback(async () => {
    setIsRefreshingBlockResult(true);
    try {
      const blockData =
        await backgroundApiProxy.serviceStaking.refreshBlockRegion();
      setBlockResult({ blockData });
    } finally {
      setIsRefreshingBlockResult(false);
    }
  }, [setBlockResult]);

  return {
    isFetchingBlockResult: isFetchingBlockResultBase || isRefreshingBlockResult,
    refreshBlockResult: handleRefreshBlockResult,
    blockResult,
  };
};
