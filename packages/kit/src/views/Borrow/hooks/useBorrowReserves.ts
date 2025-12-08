import { useCallback } from 'react';

import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import type { IBorrowReserveRequestParams } from '@onekeyhq/shared/types/staking';

export const useBorrowReserves = () => {
  const fetchReserves = useCallback(
    async (params: IBorrowReserveRequestParams) => {
      const result = await backgroundApiProxy.serviceStaking.getBorrowReserves(
        params,
      );
      return result;
    },
    [],
  );

  return { fetchReserves };
};
