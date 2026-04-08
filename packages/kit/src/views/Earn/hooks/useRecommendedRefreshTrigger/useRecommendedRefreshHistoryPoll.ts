import { useMemo } from 'react';

import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import { getNetworkIdsMap } from '@onekeyhq/shared/src/config/networkIds';
import {
  POLLING_DEBOUNCE_INTERVAL,
  POLLING_INTERVAL_FOR_HISTORY,
} from '@onekeyhq/shared/src/consts/walletConsts';

import type {
  IRecommendedRefreshAccount,
  IScheduleRecommendedRefresh,
  IShouldRefreshByAccounts,
} from './types';

export function useRecommendedRefreshHistoryPoll({
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
  const pollTargets = useMemo(() => {
    const allNetworkId = getNetworkIdsMap().onekeyall;

    if (
      networkId === allNetworkId &&
      accountId &&
      historyRefreshAccounts.length > 0
    ) {
      return [{ accountId, networkId }];
    }

    return Array.from(
      new Map(
        historyRefreshAccounts.map((account) => [
          `${account.networkId}__${account.accountId}`,
          account,
        ]),
      ).values(),
    );
  }, [accountId, historyRefreshAccounts, networkId]);

  usePromiseResult(
    async () => {
      if (!enableFetch || pollTargets.length === 0) {
        return;
      }

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

      if (
        changedAccounts.length > 0 &&
        shouldRefreshByAccounts(changedAccounts)
      ) {
        scheduleRecommendedRefresh({ source: 'app-event' });
      }
    },
    [
      enableFetch,
      pollTargets,
      scheduleRecommendedRefresh,
      shouldRefreshByAccounts,
    ],
    {
      debounced: POLLING_DEBOUNCE_INTERVAL,
      overrideIsFocused: (isFocused) => isFocused && enableFetch,
      pollingInterval: POLLING_INTERVAL_FOR_HISTORY,
    },
  );
}
