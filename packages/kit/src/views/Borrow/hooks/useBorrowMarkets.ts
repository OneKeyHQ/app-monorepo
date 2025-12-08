import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';

import { usePromiseResult } from '../../../hooks/usePromiseResult';

export const useBorrowMarkets = ({ isActive }: { isActive: boolean }) => {
  const {
    result: markets,
    isLoading = true,
    run: refetchMarkets,
  } = usePromiseResult(
    async () => {
      if (!isActive) {
        return [];
      }
      const result = await backgroundApiProxy.serviceStaking.getBorrowMarkets();
      return result;
    },
    [isActive],
    {
      initResult: [],
      watchLoading: true,
    },
  );

  return { markets, isLoading, refetchMarkets };
};
