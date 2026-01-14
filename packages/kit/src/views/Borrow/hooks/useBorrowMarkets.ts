import { useEffect, useRef } from 'react';

import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import type { IBorrowMarketItem } from '@onekeyhq/shared/types/staking';

import { usePromiseResult } from '../../../hooks/usePromiseResult';

const BORROW_POLLING_INTERVAL = 3 * 60 * 1000;
const defaultMarkets: IBorrowMarketItem[] = [];

export const useBorrowMarkets = ({
  isActive = true,
}: { isActive?: boolean } = {}) => {
  const isActiveRef = useRef(isActive);
  const marketsRef = useRef<typeof defaultMarkets>(defaultMarkets);
  const lastUpdatedAtRef = useRef<number | null>(null);

  useEffect(() => {
    isActiveRef.current = isActive;
  }, [isActive]);

  const {
    result: markets,
    isLoading = true,
    run: refetchMarkets,
  } = usePromiseResult(
    async () => {
      const cached = marketsRef.current ?? defaultMarkets;
      if (!isActiveRef.current) {
        return cached;
      }
      const lastUpdatedAt = lastUpdatedAtRef.current;
      const isStale =
        !lastUpdatedAt || Date.now() - lastUpdatedAt > BORROW_POLLING_INTERVAL;
      if (!isStale) {
        return cached;
      }
      const result = await backgroundApiProxy.serviceStaking.getBorrowMarkets();
      marketsRef.current = result;
      lastUpdatedAtRef.current = Date.now();
      return result;
    },
    [],
    {
      initResult: defaultMarkets,
      watchLoading: true,
      checkIsFocused: true,
      undefinedResultIfReRun: false,
      pollingInterval: isActive ? BORROW_POLLING_INTERVAL : undefined,
      revalidateOnFocus: false,
    },
  );

  useEffect(() => {
    if (markets) {
      marketsRef.current = markets;
    }
  }, [markets]);

  return { markets, isLoading, refetchMarkets };
};
