import { useCallback, useEffect, useMemo, useRef } from 'react';

import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { usePrevious } from '@onekeyhq/kit/src/hooks/usePrevious';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import { buildLocalTxStatusSyncId } from '@onekeyhq/kit/src/views/Staking/utils/utils';
import earnUtils from '@onekeyhq/shared/src/utils/earnUtils';
import timerUtils from '@onekeyhq/shared/src/utils/timerUtils';
import { type IAccountHistoryTx } from '@onekeyhq/shared/types/history';

export type IBorrowPendingTx = IAccountHistoryTx &
  Required<Pick<IAccountHistoryTx, 'stakingInfo'>>;

type IAccountMeta = {
  accountId: string;
  networkId: string;
  accountAddress: string;
  xpub?: string;
};

const DEFAULT_POLLING_INTERVAL = timerUtils.getTimeDurationMs({ seconds: 30 });

export const useBorrowTxUpdate = ({
  accountId,
  networkId,
  provider,
  symbol,
  onRefresh,
}: {
  accountId?: string;
  networkId?: string;
  provider?: string;
  symbol?: string;
  onRefresh?: () => void;
}) => {
  const onRefreshRef = useRef(onRefresh);
  useEffect(() => {
    onRefreshRef.current = onRefresh;
  }, [onRefresh]);

  // Get polling interval for this network
  const { result: pollingInterval } = usePromiseResult(
    async () => {
      if (!networkId) return DEFAULT_POLLING_INTERVAL;
      try {
        const time =
          await backgroundApiProxy.serviceStaking.getFetchHistoryPollingInterval(
            { networkId },
          );
        return timerUtils.getTimeDurationMs({ seconds: time });
      } catch {
        return DEFAULT_POLLING_INTERVAL;
      }
    },
    [networkId],
    { initResult: DEFAULT_POLLING_INTERVAL },
  );

  // Cache account metadata to avoid repeated calls during polling
  const { result: accountMeta } = usePromiseResult<IAccountMeta | null>(
    async () => {
      if (!accountId || !networkId) {
        return null;
      }
      try {
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
        return { accountId, networkId, accountAddress, xpub };
      } catch {
        return null;
      }
    },
    [accountId, networkId],
    { initResult: null },
  );

  // Build stake tag for filtering transactions
  const stakeTag = useMemo(() => {
    if (!provider || !symbol) return undefined;
    return buildLocalTxStatusSyncId({
      providerName: provider,
      tokenSymbol: symbol,
    });
  }, [provider, symbol]);

  const { result: txs, run: refreshPendingTxs } = usePromiseResult(
    async () => {
      if (!accountMeta || !provider) {
        return [];
      }
      try {
        const pendingTxs =
          await backgroundApiProxy.serviceHistory.getAccountLocalHistoryPendingTxs(
            {
              networkId: accountMeta.networkId,
              accountAddress: accountMeta.accountAddress,
              xpub: accountMeta.xpub,
            },
          );

        const borrowProviderName = earnUtils.getEarnProviderName({
          providerName: provider,
        });

        // Filter transactions by protocol or stakeTag
        return pendingTxs.filter((tx): tx is IBorrowPendingTx => {
          if (!tx.stakingInfo) return false;
          // Match by protocol name
          if (tx.stakingInfo.protocol === borrowProviderName) return true;
          // Match by stakeTag (for claim transactions)
          if (stakeTag && tx.stakingInfo.tags?.includes(stakeTag)) {
            return true;
          }
          return false;
        });
      } catch {
        return [];
      }
    },
    [accountMeta, provider, stakeTag],
    {
      initResult: [],
      revalidateOnFocus: true,
    },
  );

  const isPending = txs.length > 0;
  const prevIsPending = usePrevious(isPending);

  const refreshPendingWithHistory = useCallback(async () => {
    if (!accountMeta) {
      return;
    }
    try {
      await backgroundApiProxy.serviceHistory.fetchAccountHistory({
        accountId: accountMeta.accountId,
        networkId: accountMeta.networkId,
      });
      await refreshPendingTxs();
    } catch {
      // Silently handle errors during refresh
    }
  }, [accountMeta, refreshPendingTxs]);

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
      // Trigger refresh immediately when pending transactions complete
      onRefreshRef.current?.();
    }
  }, [isPending, prevIsPending]);

  return {
    isPending,
    refreshPending: refreshPendingWithHistory,
  };
};
