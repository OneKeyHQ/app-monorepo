import { useCallback, useState } from 'react';

import BigNumber from 'bignumber.js';

import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import type { IPoolPositionView } from '@onekeyhq/shared/types/pools';

import { PoolsNavigation } from './poolsNavigation';

/** Fees the user claims by hand; auto-compounding pools add them to the value */
export function canCollectPoolFees(view: IPoolPositionView) {
  return (
    view.pool.capabilities.feeCollection === 'CLAIMABLE' &&
    new BigNumber(view.uncollectedFeesUsd).gt(0)
  );
}

/** One claim per position; the task page walks the wallet steps */
export function usePoolCollect() {
  const navigation = useAppNavigation();
  const [collectingId, setCollectingId] = useState<string>();
  const collect = useCallback(
    async (view: IPoolPositionView) => {
      setCollectingId(view.position.id);
      try {
        const task = await backgroundApiProxy.servicePools.createTask({
          kind: 'collect',
          positionId: view.position.id,
        });
        PoolsNavigation.pushTask(navigation, task.id);
      } finally {
        setCollectingId(undefined);
      }
    },
    [navigation],
  );
  return { collect, collectingId };
}
