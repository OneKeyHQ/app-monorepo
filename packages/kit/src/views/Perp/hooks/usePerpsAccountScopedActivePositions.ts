import { useMemo } from 'react';

import { usePerpsActivePositionAtom } from '@onekeyhq/kit/src/states/jotai/contexts/hyperliquid';
import { usePerpsActiveAccountAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';

import { getPerpsAccountScopedListData } from '../utils/accountScopedData';

export function usePerpsAccountScopedActivePositions() {
  const [activeAccount] = usePerpsActiveAccountAtom();
  const [positionsState] = usePerpsActivePositionAtom();

  return useMemo(
    () =>
      getPerpsAccountScopedListData({
        activeAccountAddress: activeAccount?.accountAddress,
        dataAccountAddress: positionsState.accountAddress,
        data: positionsState.activePositions,
      }),
    [
      activeAccount?.accountAddress,
      positionsState.accountAddress,
      positionsState.activePositions,
    ],
  );
}
