import { useCallback, useEffect, useMemo, useRef } from 'react';

import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { usePrevious } from '@onekeyhq/kit/src/hooks/usePrevious';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import timerUtils from '@onekeyhq/shared/src/utils/timerUtils';
import type { IStakeTag } from '@onekeyhq/shared/types/staking';

import { useActiveAccount } from '../../../states/jotai/contexts/accountSelector';
import { buildLocalTxStatusSyncId } from '../../Staking/utils/utils';

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
  // Stabilize onRefresh callback reference
  const onRefreshRef = useRef(onRefresh);
  useEffect(() => {
    onRefreshRef.current = onRefresh;
  }, [onRefresh]);

  // Get polling interval for this network
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

  // Fetch pending transactions from local database
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

  const isPending = txs.length > 0;
  const prevIsPending = usePrevious(isPending);

  // Refresh both account history and pending transactions
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

  // Auto-polling when there are pending transactions
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

  // Trigger onRefresh callback when all pending transactions complete
  useEffect(() => {
    if (!isPending && prevIsPending) {
      onRefreshRef.current?.();
    }
  }, [isPending, prevIsPending]);

  return {
    pendingCount: txs.length,
    refreshPending: refreshPendingWithHistory,
  };
};

/**
 * Hook to monitor pending transactions for multiple tokens under the same protocol
 * Aggregates pending tx counts across all provided token symbols
 */
export const useProtocolMultiTokenPendingTxs = ({
  networkId,
  provider,
  symbols,
  onRefresh,
}: {
  networkId: string;
  provider: string;
  symbols: string[];
  onRefresh?: () => void;
}) => {
  const { activeAccount } = useActiveAccount({ num: 0 });
  const indexedAccountId = activeAccount?.indexedAccount?.id;

  // Stabilize onRefresh callback reference
  const onRefreshRef = useRef(onRefresh);
  useEffect(() => {
    onRefreshRef.current = onRefresh;
  }, [onRefresh]);

  // Get the network-specific accountId from indexedAccountId
  const { result: networkAccountId } = usePromiseResult(
    async () => {
      if (!indexedAccountId) {
        return undefined;
      }

      try {
        // Get derive type for the network
        const deriveType =
          await backgroundApiProxy.serviceNetwork.getGlobalDeriveTypeOfNetwork({
            networkId,
          });

        const account =
          await backgroundApiProxy.serviceAccount.getNetworkAccount({
            accountId: undefined,
            indexedAccountId,
            networkId,
            deriveType,
          });
        return account?.id;
      } catch (error) {
        return undefined;
      }
    },
    [indexedAccountId, networkId],
    { initResult: undefined },
  );

  // Get polling interval for this network
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

  // Build stake tags for all symbols using buildLocalTxStatusSyncId
  const stakeTags = useMemo(
    () =>
      symbols.map((symbol) =>
        buildLocalTxStatusSyncId({
          providerName: provider,
          tokenSymbol: symbol,
        }),
      ),
    [provider, symbols],
  );

  // Fetch pending transactions for all tokens in parallel
  const fetchAllPendingTxs = useCallback(async () => {
    if (!networkAccountId || symbols.length === 0) {
      return [];
    }

    const txsPromises = stakeTags.map((stakeTag) =>
      backgroundApiProxy.serviceStaking.fetchLocalStakingHistory({
        accountId: networkAccountId,
        networkId,
        stakeTag,
      }),
    );

    const results = await Promise.all(txsPromises);
    return results.flat();
  }, [networkAccountId, networkId, stakeTags, symbols.length]);

  const { result: allTxs, run: refreshPendingTxs } = usePromiseResult(
    fetchAllPendingTxs,
    [fetchAllPendingTxs],
    {
      initResult: [],
      revalidateOnFocus: true,
    },
  );

  const isPending = allTxs.length > 0;
  const prevIsPending = usePrevious(isPending);

  // Refresh both account history and pending transactions
  const refreshPendingWithHistory = useCallback(async () => {
    if (!networkAccountId) {
      return;
    }
    await backgroundApiProxy.serviceHistory.fetchAccountHistory({
      accountId: networkAccountId,
      networkId,
    });
    await refreshPendingTxs();
  }, [networkAccountId, networkId, refreshPendingTxs]);

  // Auto-polling when there are pending transactions
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

  // Trigger onRefresh callback when all pending transactions complete
  useEffect(() => {
    if (!isPending && prevIsPending) {
      onRefreshRef.current?.();
    }
  }, [isPending, prevIsPending]);

  return {
    pendingCount: allTxs.length,
    refreshPending: refreshPendingWithHistory,
  };
};
