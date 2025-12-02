import { useCallback, useEffect, useMemo, useRef } from 'react';

import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { usePrevious } from '@onekeyhq/kit/src/hooks/usePrevious';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import timerUtils from '@onekeyhq/shared/src/utils/timerUtils';
import { EAvailableAssetsTypeEnum } from '@onekeyhq/shared/types/earn';
import type { IAccountHistoryTx } from '@onekeyhq/shared/types/history';
import type { IStakeTag } from '@onekeyhq/shared/types/staking';

import { useActiveAccount } from '../../../states/jotai/contexts/accountSelector';
import { useEarnAtom } from '../../../states/jotai/contexts/earn';
import { buildLocalTxStatusSyncId } from '../../Staking/utils/utils';

export type IStakePendingTx = IAccountHistoryTx &
  Required<Pick<IAccountHistoryTx, 'stakingInfo'>>;

type INetworkAccountMeta = {
  accountId: string;
  accountAddress: string;
  xpub?: string;
};

const DEFAULT_POLLING_INTERVAL = timerUtils.getTimeDurationMs({ seconds: 30 });

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
 * Hook to monitor pending transactions based on stakingInfo filter
 * Automatically monitors pending transactions for all staking positions
 */
export const useStakingPendingTxsByInfo = ({
  filter,
  onRefresh,
}: {
  filter?: (tx: IStakePendingTx) => boolean;
  onRefresh?: () => void;
}) => {
  const { activeAccount } = useActiveAccount({ num: 0 });
  const { account, indexedAccount } = activeAccount;
  const accountId = account?.id;
  const currentNetworkId = activeAccount.network?.id;
  const [{ availableAssetsByType = {} }] = useEarnAtom();

  // Stabilize onRefresh callback reference
  const onRefreshRef = useRef(onRefresh);
  useEffect(() => {
    onRefreshRef.current = onRefresh;
  }, [onRefresh]);

  // Prefer the "All" tab data, otherwise merge everything we have locally
  const availableAssets = useMemo(() => {
    const assetsFromAll = availableAssetsByType?.[EAvailableAssetsTypeEnum.All];
    const mergedAssets =
      assetsFromAll ?? Object.values(availableAssetsByType).flat();
    if (!mergedAssets || mergedAssets.length === 0) return [];

    const mergedByKey = new Map<string, (typeof mergedAssets)[number]>();
    mergedAssets.forEach((asset) => {
      const key = `${asset.symbol}-${asset.name}`;
      const existing = mergedByKey.get(key);
      if (!existing) {
        mergedByKey.set(key, {
          ...asset,
          protocols: [...(asset.protocols ?? [])],
        });
        return;
      }

      const existingProtocols = existing.protocols ?? [];
      const protocolKeys = new Set(
        existingProtocols.map(
          (protocol) =>
            `${protocol.networkId}-${protocol.provider}-${
              protocol.vault ?? ''
            }`,
        ),
      );
      asset.protocols?.forEach((protocol) => {
        const protocolKey = `${protocol.networkId}-${protocol.provider}-${
          protocol.vault ?? ''
        }`;
        if (!protocolKeys.has(protocolKey)) {
          protocolKeys.add(protocolKey);
          existingProtocols.push(protocol);
        }
      });
      existing.protocols = existingProtocols;
    });
    return Array.from(mergedByKey.values());
  }, [availableAssetsByType]);

  // Build unique staking targets (network + stakeTag) from available assets
  const stakingTargets = useMemo(() => {
    const seen = new Set<string>();
    const targets: { networkId: string; stakeTag: IStakeTag }[] = [];

    availableAssets.forEach((asset) => {
      asset.protocols?.forEach(({ networkId, provider }) => {
        if (!networkId || !provider) {
          return;
        }
        const stakeTag = buildLocalTxStatusSyncId({
          providerName: provider,
          tokenSymbol: asset.symbol,
        });
        const key = `${networkId}-${stakeTag}`;
        if (seen.has(key)) {
          return;
        }
        seen.add(key);
        targets.push({ networkId, stakeTag });
      });
    });

    return targets;
  }, [availableAssets]);

  const stakeTagsByNetwork = useMemo(
    () =>
      stakingTargets.reduce<Record<string, Set<IStakeTag>>>((acc, target) => {
        if (!acc[target.networkId]) {
          acc[target.networkId] = new Set<IStakeTag>();
        }
        acc[target.networkId].add(target.stakeTag);
        return acc;
      }, {}),
    [stakingTargets],
  );

  const networkIds = useMemo<string[]>(
    () => [...new Set(stakingTargets.map((target) => target.networkId))],
    [stakingTargets],
  );

  // Get the minimum polling interval across all networks
  const { result: pollingInterval } = usePromiseResult(
    async () => {
      if (networkIds.length === 0) return DEFAULT_POLLING_INTERVAL;
      const intervals = await Promise.all(
        networkIds.map((networkId: string) =>
          backgroundApiProxy.serviceStaking
            .getFetchHistoryPollingInterval({
              networkId,
            })
            .catch(() => 30),
        ),
      );
      const minInterval = Math.min(...intervals);
      return timerUtils.getTimeDurationMs({ seconds: minInterval });
    },
    [networkIds],
    { initResult: DEFAULT_POLLING_INTERVAL },
  );

  // Resolve network-specific accountIds for the active indexed account
  const { result: networkAccountMap } = usePromiseResult<
    Record<string, string>
  >(
    async () => {
      const map: Record<string, string> = {};

      if (
        accountId &&
        currentNetworkId &&
        networkIds.includes(currentNetworkId)
      ) {
        map[currentNetworkId] = accountId;
      }

      if (!indexedAccount?.id || networkIds.length === 0) {
        return map;
      }

      try {
        const accounts =
          await backgroundApiProxy.serviceAccount.getNetworkAccountsInSameIndexedAccountId(
            {
              indexedAccountId: indexedAccount.id,
              networkIds,
            },
          );

        accounts.forEach(({ network, account: networkAccount }) => {
          if (network?.id && networkAccount?.id) {
            map[network.id] = networkAccount.id;
          }
        });
      } catch {
        // Best-effort account resolution; keep whatever we have
      }

      return map;
    },
    [accountId, currentNetworkId, indexedAccount?.id, networkIds],
    { initResult: {} },
  );

  const { result: accountMetaByNetwork } = usePromiseResult<
    Record<string, INetworkAccountMeta>
  >(
    async () => {
      const entries = Object.entries(networkAccountMap);
      if (entries.length === 0) {
        return {} as Record<string, INetworkAccountMeta>;
      }

      const meta: Record<string, INetworkAccountMeta> = {};
      await Promise.all(
        entries.map(async ([networkId, accountForNetwork]) => {
          try {
            const [xpub, accountAddress] = await Promise.all([
              backgroundApiProxy.serviceAccount.getAccountXpub({
                accountId: accountForNetwork,
                networkId,
              }),
              backgroundApiProxy.serviceAccount.getAccountAddressForApi({
                accountId: accountForNetwork,
                networkId,
              }),
            ]);

            meta[networkId] = {
              accountId: accountForNetwork,
              accountAddress,
              xpub,
            };
          } catch {
            // Skip networks we cannot resolve
          }
        }),
      );

      return meta;
    },
    [networkAccountMap],
    { initResult: {} as Record<string, INetworkAccountMeta> },
  );

  // Fetch pending transactions based on available assets
  const fetchFilteredPendingTxs = useCallback(async (): Promise<
    IStakePendingTx[]
  > => {
    if (Object.keys(stakeTagsByNetwork).length === 0) {
      return [];
    }

    const targetsWithAccount = Object.entries(accountMetaByNetwork).filter(
      ([networkId]) => stakeTagsByNetwork[networkId]?.size,
    );
    if (targetsWithAccount.length === 0) {
      return [];
    }

    const txsForTargets = await Promise.all(
      targetsWithAccount.map(async ([networkId, meta]) => {
        const stakeTags = stakeTagsByNetwork[networkId];
        if (!stakeTags?.size) {
          return [];
        }
        try {
          const pendingTxs =
            await backgroundApiProxy.serviceHistory.getAccountLocalHistoryPendingTxs(
              {
                networkId,
                accountAddress: meta.accountAddress,
                xpub: meta.xpub,
              },
            );

          return pendingTxs.filter((tx): tx is IStakePendingTx =>
            Boolean(
              tx.stakingInfo &&
                tx.stakingInfo.tags.some((tag) => stakeTags.has(tag)),
            ),
          );
        } catch {
          return [];
        }
      }),
    );

    const allTxs: IStakePendingTx[] = txsForTargets.flat();

    // Apply custom filter if provided
    if (filter) {
      return allTxs.filter(filter);
    }

    return allTxs;
  }, [accountMetaByNetwork, filter, stakeTagsByNetwork]);

  const { result: filteredTxs, run: refreshPendingTxs } = usePromiseResult(
    fetchFilteredPendingTxs,
    [fetchFilteredPendingTxs],
    {
      initResult: [],
      revalidateOnFocus: true,
    },
  );

  const isPending = filteredTxs.length > 0;
  const prevIsPending = usePrevious(isPending);

  // Refresh both account history and pending transactions
  const refreshPendingWithHistory = useCallback(async () => {
    const accounts = Object.entries(networkAccountMap);
    if (accounts.length === 0) {
      return;
    }

    // Refresh history for all networks that have available assets
    await Promise.all(
      accounts.map(([networkId, pendingAccountId]) =>
        backgroundApiProxy.serviceHistory
          .fetchAccountHistory({
            accountId: pendingAccountId,
            networkId,
          })
          .catch(() => {
            // Skip networks that fail
          }),
      ),
    );

    await refreshPendingTxs();
  }, [networkAccountMap, refreshPendingTxs]);

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
    filteredTxs,
    pendingCount: filteredTxs.length,
    refreshPending: refreshPendingWithHistory,
  };
};
