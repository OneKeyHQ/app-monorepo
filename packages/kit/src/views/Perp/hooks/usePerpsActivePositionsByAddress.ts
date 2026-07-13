import { useMemo } from 'react';

import { usePerpsActivePositionAtom } from '@onekeyhq/kit/src/states/jotai/contexts/hyperliquid';

import { getPerpsAccountScopedListData } from '../utils/accountScopedData';

export function usePerpsActivePositionsByAddress(
  activeAccountAddress?: string | null,
) {
  const [positionsState] = usePerpsActivePositionAtom();

  return useMemo(
    () =>
      getPerpsAccountScopedListData({
        activeAccountAddress,
        dataAccountAddress: positionsState.accountAddress,
        data: positionsState.activePositions,
      }),
    [
      activeAccountAddress,
      positionsState.accountAddress,
      positionsState.activePositions,
    ],
  );
}
