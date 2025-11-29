import { useCallback, useEffect, useMemo } from 'react';

import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { usePrevious } from '@onekeyhq/kit/src/hooks/usePrevious';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import timerUtils from '@onekeyhq/shared/src/utils/timerUtils';
import type { IStakeTag } from '@onekeyhq/shared/types/staking';

export const useStakingPendingTxs = ({
  accountId,
  networkId,
  stakeTag,
  onRefresh,
}: {
  accountId?: string;
  networkId: string;
  stakeTag?: IStakeTag;
  onRefresh?: () => void;
}) => {
  const { result: pollingInterval } = usePromiseResult(
    async () => {
      const time =
        await backgroundApiProxy.serviceStaking.getFetchHistoryPollingInterval({
          networkId,
        });
      return timerUtils.getTimeDurationMs({ seconds: time });
    },
    [networkId],
    { initResult: timerUtils.getTimeDurationMs({ seconds: 30 }) },
  );

  const { result: txs, run: refreshPendingTxs } = usePromiseResult(
    async () => {
      if (!accountId || !stakeTag) {
        return [];
      }
      return backgroundApiProxy.serviceStaking.fetchLocalStakingHistory({
        accountId,
        networkId,
        stakeTag,
      });
    },
    [accountId, networkId, stakeTag],
    {
      initResult: [],
      revalidateOnFocus: true,
    },
  );

  const isPending = useMemo(() => txs.length > 0, [txs.length]);
  const prevIsPending = usePrevious(isPending);

  const refreshPendingWithHistory = useCallback(async () => {
    if (!accountId || !stakeTag) {
      return;
    }
    await backgroundApiProxy.serviceHistory.fetchAccountHistory({
      accountId,
      networkId,
    });
    await refreshPendingTxs();
  }, [accountId, networkId, stakeTag, refreshPendingTxs]);

  usePromiseResult(
    async () => {
      if (!isPending || !accountId || !stakeTag) {
        return;
      }

      await backgroundApiProxy.serviceHistory.fetchAccountHistory({
        accountId,
        networkId,
      });

      await refreshPendingTxs();
    },
    [isPending, accountId, networkId, stakeTag, refreshPendingTxs],
    {
      pollingInterval,
    },
  );

  useEffect(() => {
    if (!isPending && prevIsPending) {
      onRefresh?.();
    }
  }, [isPending, prevIsPending, onRefresh]);

  return {
    pendingCount: txs.length,
    refreshPending: refreshPendingWithHistory,
  };
};
