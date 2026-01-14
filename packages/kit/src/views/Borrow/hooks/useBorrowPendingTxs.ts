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
  isActive = true,
}: {
  accountId?: string;
  networkId?: string;
  provider?: string;
  onRefresh?: () => void;
  isActive?: boolean;
}) => {
  const onRefreshRef = useRef(onRefresh);
  const isActiveRef = useRef(isActive);
  const pendingTxsRef = useRef<IBorrowPendingTx[]>([]);
  const accountMetaRef = useRef<IAccountMeta | null>(null);
  useEffect(() => {
    onRefreshRef.current = onRefresh;
  }, [onRefresh]);
  useEffect(() => {
    isActiveRef.current = isActive;
  }, [isActive]);

  const { result: pollingInterval } = usePromiseResult(
    async () => {
      if (!isActiveRef.current) return DEFAULT_POLLING_INTERVAL;
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [networkId, isActive],
    { initResult: DEFAULT_POLLING_INTERVAL },
  );

  const { result: accountMeta } = usePromiseResult<IAccountMeta | null>(
    async () => {
      if (!isActiveRef.current) {
        return accountMetaRef.current;
      }
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [accountId, networkId, isActive],
    { initResult: null },
  );

  const { result: pendingTxs, run: refreshPendingTxs } = usePromiseResult(
    async () => {
      if (!isActiveRef.current) {
        return pendingTxsRef.current;
      }
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [accountMeta, provider, isActive],
    {
      initResult: [],
      revalidateOnFocus: true,
    },
  );

  const pendingCount = pendingTxs.length;
  const isPending = pendingCount > 0;
  const prevIsPending = usePrevious(isPending);

  const refreshPendingWithHistory = useCallback(async () => {
    if (!isActiveRef.current) {
      return;
    }
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
      if (!isActiveRef.current || !isPending) return;
      await refreshPendingWithHistory();
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [isPending, refreshPendingWithHistory, isActive],
    {
      pollingInterval: isActive ? pollingInterval : undefined,
    },
  );

  // Trigger onRefresh callback when all pending transactions complete
  // Use 3-second delay to allow backend data sync after transaction confirmation
  useEffect(() => {
    if (!isPending && prevIsPending) {
      const timeoutId = setTimeout(() => {
        onRefreshRef.current?.();
      }, timerUtils.getTimeDurationMs({ seconds: 3 }));
      return () => clearTimeout(timeoutId);
    }
    return undefined;
  }, [isPending, prevIsPending]);

  useEffect(() => {
    if (accountMeta) {
      accountMetaRef.current = accountMeta;
    }
  }, [accountMeta]);

  useEffect(() => {
    pendingTxsRef.current = pendingTxs;
  }, [pendingTxs]);

  return {
    pendingTxs,
    pendingCount,
    refreshPending: refreshPendingWithHistory,
  };
};
