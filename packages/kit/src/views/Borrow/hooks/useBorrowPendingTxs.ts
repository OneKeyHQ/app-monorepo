import { useCallback, useEffect, useRef } from 'react';

import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { usePrevious } from '@onekeyhq/kit/src/hooks/usePrevious';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import {
  isBorrowTag,
  parseBorrowTag,
} from '@onekeyhq/kit/src/views/Staking/utils/utils';
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

export const useBorrowPendingTxs = ({
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

  const { result: pendingTxs, run: refreshPendingTxs } = usePromiseResult(
    async () => {
      if (!accountMeta) {
        return [];
      }
      try {
        const pending =
          await backgroundApiProxy.serviceHistory.getAccountLocalHistoryPendingTxs(
            {
              networkId: accountMeta.networkId,
              accountAddress: accountMeta.accountAddress,
              xpub: accountMeta.xpub,
            },
          );

        const providerLower = provider?.toLowerCase();

        return pending.filter((tx): tx is IBorrowPendingTx => {
          if (!tx.stakingInfo) return false;
          const tags = tx.stakingInfo.tags ?? [];
          return tags.some((tag) => {
            if (!isBorrowTag(tag)) return false;
            const parsed = parseBorrowTag(tag);
            if (!parsed) return false;
            if (!providerLower) return true;
            return parsed.provider === providerLower;
          });
        });
      } catch {
        return [];
      }
    },
    [accountMeta, provider],
    {
      initResult: [],
      revalidateOnFocus: true,
    },
  );

  const pendingCount = pendingTxs.length;
  const isPending = pendingCount > 0;
  const prevPendingCount = usePrevious(pendingCount);

  const refreshPendingWithHistory = useCallback(async () => {
    if (!accountMeta) {
      return;
    }
    await backgroundApiProxy.serviceHistory.fetchAccountHistory({
      accountId: accountMeta.accountId,
      networkId: accountMeta.networkId,
    });
    await refreshPendingTxs();
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
    if (prevPendingCount !== undefined && pendingCount < prevPendingCount) {
      const timeoutId = setTimeout(() => {
        onRefreshRef.current?.();
      }, timerUtils.getTimeDurationMs({ seconds: 1 }));
      return () => clearTimeout(timeoutId);
    }
    return undefined;
  }, [pendingCount, prevPendingCount]);

  return {
    pendingTxs,
    pendingCount,
    refreshPending: refreshPendingWithHistory,
  };
};
