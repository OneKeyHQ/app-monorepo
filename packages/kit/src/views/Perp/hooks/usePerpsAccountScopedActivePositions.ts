import { useMemo } from 'react';

import { usePerpsActivePositionAtom } from '@onekeyhq/kit/src/states/jotai/contexts/hyperliquid';

import { getPerpsAccountScopedListData } from '../utils/accountScopedData';

import { usePerpsAccountScopedCacheAddress } from './usePerpsAccountScopedCacheAddress';

export function usePerpsAccountScopedActivePositions() {
  const accountScopedAddress = usePerpsAccountScopedCacheAddress();
  const [positionsState] = usePerpsActivePositionAtom();

  return useMemo(
    () =>
      getPerpsAccountScopedListData({
        activeAccountAddress: accountScopedAddress,
        dataAccountAddress: positionsState.accountAddress,
        data: positionsState.activePositions,
      }),
    [
      accountScopedAddress,
      positionsState.accountAddress,
      positionsState.activePositions,
    ],
  );
}
