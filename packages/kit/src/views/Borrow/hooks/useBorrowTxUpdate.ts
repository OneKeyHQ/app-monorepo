import { useCallback, useEffect, useMemo, useRef } from 'react';

import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { usePrevious } from '@onekeyhq/kit/src/hooks/usePrevious';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import earnUtils from '@onekeyhq/shared/src/utils/earnUtils';
import timerUtils from '@onekeyhq/shared/src/utils/timerUtils';
import { type IAccountHistoryTx } from '@onekeyhq/shared/types/history';

export type IBorrowPendingTx = IAccountHistoryTx &
  Required<Pick<IAccountHistoryTx, 'stakingInfo'>>;

export const useBorrowTxUpdate = ({
  accountId,
  networkId,
  provider,
  onRefresh,
}: {
  accountId?: string;
  networkId?: string;
  provider?: string;
  onRefresh?: () => void;
}) => {
  const onRefreshRef = useRef(onRefresh);
  useEffect(() => {
    onRefreshRef.current = onRefresh;
  }, [onRefresh]);

  const { result: pollingInterval } = usePromiseResult(
    async () => {
      if (!networkId) return timerUtils.getTimeDurationMs({ seconds: 30 });
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
      if (!accountId || !networkId || !provider) {
        return [];
      }
      const [xpub, accountAddress] = await Promise.all([
        backgroundApiProxy.serviceAccount.getAccountXpub({
          accountId,
          networkId,
        }),
        backgroundApiProxy.serviceAccount.getAccountAddressForApi({
          accountId,
          networkId,
        }),
      ]);

      const pendingTxs =
        await backgroundApiProxy.serviceHistory.getAccountLocalHistoryPendingTxs(
          {
            networkId,
            accountAddress,
            xpub,
          },
        );

      const borrowProviderName = earnUtils.getEarnProviderName({
        providerName: provider,
      });

      return pendingTxs.filter((tx): tx is IBorrowPendingTx => {
        if (!tx.stakingInfo) return false;
        // Filter by protocol name matches current provider
        return tx.stakingInfo.protocol === borrowProviderName;
      });
    },
    [accountId, networkId, provider],
    {
      initResult: [],
      revalidateOnFocus: true,
    },
  );

  const isPending = txs.length > 0;
  const prevIsPending = usePrevious(isPending);

  const refreshPendingWithHistory = useCallback(async () => {
    if (!accountId || !networkId) {
      return;
    }
    await backgroundApiProxy.serviceHistory.fetchAccountHistory({
      accountId,
      networkId,
    });
    await refreshPendingTxs();
  }, [accountId, networkId, refreshPendingTxs]);

  usePromiseResult(
    async () => {
      if (!isPending) return;
      await refreshPendingWithHistory();
    },
    [isPending, refreshPendingWithHistory],
    {
      pollingInterval,
    },
  );

  useEffect(() => {
    if (!isPending && prevIsPending) {
      setTimeout(() => {
        onRefreshRef.current?.();
      }, timerUtils.getTimeDurationMs({ seconds: 3 }));
    }
  }, [isPending, prevIsPending]);

  return {
    isPending,
    refreshPending: refreshPendingWithHistory,
  };
};
