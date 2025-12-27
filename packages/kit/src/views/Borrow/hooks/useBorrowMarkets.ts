import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';

import { usePromiseResult } from '../../../hooks/usePromiseResult';

const BORROW_POLLING_INTERVAL = 3 * 60 * 1000;

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
      pollingInterval: BORROW_POLLING_INTERVAL,
      revalidateOnFocus: true,
    },
  );

  return { markets, isLoading, refetchMarkets };
};
