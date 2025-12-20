import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';

import { usePromiseResult } from '../../../hooks/usePromiseResult';

export const useBlockRegion = () => {
  const {
    isLoading: isFetchingBlockResult,
    run: refreshBlockResult,
    result: blockResult,
  } = usePromiseResult(
    async () => {
      const blockData =
        await backgroundApiProxy.serviceStaking.getBlockRegion();
      return { blockData };
    },
    [],
    {
      revalidateOnFocus: true,
    },
  );

  return { isFetchingBlockResult, refreshBlockResult, blockResult };
};
