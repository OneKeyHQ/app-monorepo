import { useEffect, useRef } from 'react';

import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { getNetworkIdsMap } from '@onekeyhq/shared/src/config/networkIds';
import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
import timerUtils from '@onekeyhq/shared/src/utils/timerUtils';
import { ESwapTxHistoryStatus } from '@onekeyhq/shared/types/swap/types';

import type {
  IRecommendedRefreshAccount,
  IScheduleRecommendedRefresh,
  IShouldRefreshByAccounts,
} from './types';

const SWAP_HISTORY_SYNC_CHECK_DELAY = timerUtils.getTimeDurationMs({
  seconds: 5,
});

const SWAP_HISTORY_SYNC_MAX_RETRIES = 3;

export function useRecommendedRefreshSwapEvents({
  accountId,
  networkId,
  enableFetch,
  historyRefreshAccounts,
  shouldRefreshByAccounts,
  scheduleRecommendedRefresh,
}: {
  accountId?: string;
  networkId: string;
  enableFetch: boolean;
  historyRefreshAccounts: IRecommendedRefreshAccount[];
  shouldRefreshByAccounts: IShouldRefreshByAccounts;
  scheduleRecommendedRefresh: IScheduleRecommendedRefresh;
}) {
  const retryTokenRef = useRef(0);
  const retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (retryTimerRef.current) {
        clearTimeout(retryTimerRef.current);
        retryTimerRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (!enableFetch || historyRefreshAccounts.length === 0) {
      return;
    }

    const clearPendingRetry = () => {
      if (retryTimerRef.current) {
        clearTimeout(retryTimerRef.current);
        retryTimerRef.current = null;
      }
    };

    const allNetworkId = getNetworkIdsMap().onekeyall;
    const pollTargets =
      networkId === allNetworkId && accountId && historyRefreshAccounts.length
        ? [{ accountId, networkId }]
        : historyRefreshAccounts;

    const runSwapHistorySyncCheck = async ({
      token,
      retryCount,
    }: {
      token: number;
      retryCount: number;
    }) => {
      try {
        const results = await Promise.all(
          pollTargets.map((account) =>
            backgroundApiProxy.serviceHistory
              .fetchAccountHistory({
                accountId: account.accountId,
                networkId: account.networkId,
              })
              .catch(() => undefined),
          ),
        );
        const changedAccounts = results.flatMap(
          (result) => result?.accountsWithChangedTxs ?? [],
        );

        if (retryTokenRef.current !== token) {
          return;
        }

        if (
          changedAccounts.length > 0 &&
          shouldRefreshByAccounts(changedAccounts)
        ) {
          scheduleRecommendedRefresh({ source: 'app-event' });
          return;
        }
      } catch {
        // Best-effort retry flow for swap history synchronization.
      }

      if (retryTokenRef.current !== token) {
        return;
      }

      if (retryCount >= SWAP_HISTORY_SYNC_MAX_RETRIES) {
        scheduleRecommendedRefresh({ source: 'app-event' });
        return;
      }

      retryTimerRef.current = setTimeout(() => {
        retryTimerRef.current = null;
        void runSwapHistorySyncCheck({
          token,
          retryCount: retryCount + 1,
        });
      }, SWAP_HISTORY_SYNC_CHECK_DELAY);
    };

    const handleSwapTxHistoryStatusUpdate = ({
      status,
    }: {
      status?: ESwapTxHistoryStatus;
    }) => {
      if (
        status !== ESwapTxHistoryStatus.SUCCESS &&
        status !== ESwapTxHistoryStatus.PARTIALLY_FILLED
      ) {
        return;
      }

      retryTokenRef.current += 1;
      const currentToken = retryTokenRef.current;
      clearPendingRetry();

      retryTimerRef.current = setTimeout(() => {
        retryTimerRef.current = null;
        void runSwapHistorySyncCheck({
          token: currentToken,
          retryCount: 1,
        });
      }, SWAP_HISTORY_SYNC_CHECK_DELAY);
    };

    appEventBus.on(
      EAppEventBusNames.SwapTxHistoryStatusUpdate,
      handleSwapTxHistoryStatusUpdate,
    );

    return () => {
      retryTokenRef.current += 1;
      clearPendingRetry();
      appEventBus.off(
        EAppEventBusNames.SwapTxHistoryStatusUpdate,
        handleSwapTxHistoryStatusUpdate,
      );
    };
  }, [
    accountId,
    enableFetch,
    historyRefreshAccounts,
    networkId,
    scheduleRecommendedRefresh,
    shouldRefreshByAccounts,
  ]);
}
