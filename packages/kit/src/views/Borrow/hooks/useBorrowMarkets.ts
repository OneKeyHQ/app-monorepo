import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';

import { usePromiseResult } from '../../../hooks/usePromiseResult';

export const useBorrowMarkets = () => {
  const {
    result: markets,
    isLoading = true,
    run: refetchMarkets,
  } = usePromiseResult(
    async () => {
      const result = await backgroundApiProxy.serviceStaking.getBorrowMarkets();
      return result;
    },
    [],
    {
      initResult: [],
      watchLoading: true,
      checkIsFocused: true,
      undefinedResultIfReRun: false,
    },
  );

  return { markets, isLoading, refetchMarkets };
};
