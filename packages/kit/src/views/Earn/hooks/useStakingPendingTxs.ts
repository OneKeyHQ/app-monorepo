import { useCallback, useEffect, useMemo, useRef } from 'react';

import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { usePrevious } from '@onekeyhq/kit/src/hooks/usePrevious';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import networkUtils from '@onekeyhq/shared/src/utils/networkUtils';
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
      // Delay refresh to allow backend data sync after transaction confirmation
      setTimeout(
        () => {
          onRefreshRef.current?.();
        },
        timerUtils.getTimeDurationMs({ seconds: 3 }),
      );
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
  networkIds,
  tagMatcher,
  onRefreshDelayMs = 0,
}: {
  filter?: (tx: IStakePendingTx) => boolean;
  onRefresh?: () => void;
  networkIds?: string[];
  tagMatcher?: (tag: string) => boolean;
  onRefreshDelayMs?: number;
}) => {
  const { activeAccount } = useActiveAccount({ num: 0 });
  const { account, indexedAccount } = activeAccount;
  const accountId = account?.id;
  const currentNetworkId = activeAccount.network?.id;
  const [{ availableAssetsByType = {} }] = useEarnAtom();
  const shouldUseEarnAssets = !tagMatcher;
  const lastFilteredTxsRef = useRef<IStakePendingTx[]>([]);
  const refreshTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Stabilize onRefresh callback reference
  const onRefreshRef = useRef(onRefresh);
  useEffect(() => {
    onRefreshRef.current = onRefresh;
  }, [onRefresh]);

  // Prefer new available-assets groups, then fall back to cached groups.
  const availableAssets = useMemo(() => {
    if (!shouldUseEarnAssets) {
      return [];
    }

    const groupedAssets = [
      EAvailableAssetsTypeEnum.SimpleEarn,
      EAvailableAssetsTypeEnum.FixedRate,
      EAvailableAssetsTypeEnum.Staking,
    ].flatMap((type) => availableAssetsByType?.[type] ?? []);

    const mergedAssets =
      groupedAssets.length > 0
        ? groupedAssets
        : Object.values(availableAssetsByType).flat();

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
  }, [availableAssetsByType, shouldUseEarnAssets]);

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

  const derivedNetworkIds = useMemo<string[]>(
    () => [...new Set(stakingTargets.map((target) => target.networkId))],
    [stakingTargets],
  );

  const effectiveNetworkIds = useMemo(() => {
    if (networkIds?.length) {
      return [...new Set(networkIds.filter(Boolean))];
    }
    return derivedNetworkIds;
  }, [derivedNetworkIds, networkIds]);

  // Get the minimum polling interval across all networks
  const { result: pollingInterval } = usePromiseResult(
    async () => {
      if (effectiveNetworkIds.length === 0) return DEFAULT_POLLING_INTERVAL;
      const intervals = await Promise.all(
        effectiveNetworkIds.map((networkId: string) =>
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
    [effectiveNetworkIds],
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
        effectiveNetworkIds.includes(currentNetworkId)
      ) {
        map[currentNetworkId] = accountId;
      }

      if (!indexedAccount?.id || effectiveNetworkIds.length === 0) {
        return map;
      }

      try {
        const accounts =
          await backgroundApiProxy.serviceAccount.getNetworkAccountsInSameIndexedAccountId(
            {
              indexedAccountId: indexedAccount.id,
              networkIds: effectiveNetworkIds,
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

      // For BTC networks in Earn, ensure taproot (BIP86) account is used
      await Promise.all(
        Object.keys(map).map(async (netId) => {
          if (networkUtils.isBTCNetwork(netId)) {
            try {
              const earnAccount =
                await backgroundApiProxy.serviceStaking.getEarnAccount({
                  accountId: map[netId],
                  networkId: netId,
                  indexedAccountId: indexedAccount.id,
                  btcOnlyTaproot: true,
                });
              if (earnAccount?.accountId) {
                map[netId] = earnAccount.accountId;
              }
            } catch {
              // Keep existing account if taproot resolution fails
            }
          }
        }),
      );

      return map;
    },
    [accountId, currentNetworkId, indexedAccount?.id, effectiveNetworkIds],
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

  // Fetch pending transactions based on stake tags or tag matcher
  const fetchFilteredPendingTxs = useCallback(async (): Promise<
    IStakePendingTx[]
  > => {
    if (effectiveNetworkIds.length === 0) {
      return [];
    }

    if (!tagMatcher && Object.keys(stakeTagsByNetwork).length === 0) {
      return [];
    }

    const targetsWithAccount = Object.entries(accountMetaByNetwork).filter(
      ([networkId]) => {
        if (!effectiveNetworkIds.includes(networkId)) {
          return false;
        }
        if (tagMatcher) {
          return true;
        }
        return stakeTagsByNetwork[networkId]?.size;
      },
    );
    if (targetsWithAccount.length === 0) {
      return [];
    }

    const txsForTargets = await Promise.all(
      targetsWithAccount.map(async ([networkId, meta]) => {
        try {
          const pendingTxs =
            await backgroundApiProxy.serviceHistory.getAccountLocalHistoryPendingTxs(
              {
                networkId,
                accountAddress: meta.accountAddress,
                xpub: meta.xpub,
              },
            );

          const matchedTxs = pendingTxs.filter((tx): tx is IStakePendingTx => {
            if (!tx.stakingInfo) return false;
            const tags = tx.stakingInfo.tags ?? [];
            if (tags.length === 0) return false;
            if (tagMatcher) {
              return tags.some((tag) => tagMatcher(tag));
            }
            const stakeTags = stakeTagsByNetwork[networkId];
            if (!stakeTags?.size) return false;
            return tags.some((tag) => stakeTags.has(tag));
          });

          return {
            ok: true,
            txs: matchedTxs,
          };
        } catch {
          return {
            ok: false,
            txs: [] as IStakePendingTx[],
          };
        }
      }),
    );

    const okResults = txsForTargets.filter((result) => result.ok);
    if (okResults.length === 0) {
      return lastFilteredTxsRef.current;
    }

    const allTxs: IStakePendingTx[] = okResults.flatMap((result) => result.txs);

    // Apply custom filter if provided
    const nextTxs = filter ? allTxs.filter(filter) : allTxs;
    lastFilteredTxsRef.current = nextTxs;

    return nextTxs;
  }, [
    accountMetaByNetwork,
    effectiveNetworkIds,
    filter,
    stakeTagsByNetwork,
    tagMatcher,
  ]);

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
  const prevPendingCountRef = useRef<number | null>(null);

  useEffect(() => {
    const nextCount = filteredTxs.length;
    if (prevPendingCountRef.current !== nextCount) {
      prevPendingCountRef.current = nextCount;
    }
  }, [filteredTxs.length]);

  useEffect(() => {
    if (!isPending || !refreshTimeoutRef.current) {
      return;
    }
    clearTimeout(refreshTimeoutRef.current);
    refreshTimeoutRef.current = null;
  }, [isPending]);

  useEffect(() => {
    if (!isPending && prevIsPending) {
      if (onRefreshDelayMs > 0) {
        refreshTimeoutRef.current = setTimeout(() => {
          onRefreshRef.current?.();
          refreshTimeoutRef.current = null;
        }, onRefreshDelayMs);
      } else {
        onRefreshRef.current?.();
      }
    }
  }, [isPending, prevIsPending, onRefreshDelayMs]);

  useEffect(() => {
    return () => {
      if (refreshTimeoutRef.current) {
        clearTimeout(refreshTimeoutRef.current);
        refreshTimeoutRef.current = null;
      }
    };
  }, []);

  // Refresh both account history and pending transactions
  const refreshPendingWithHistory = useCallback(async () => {
    const accounts = Object.entries(networkAccountMap);
    if (accounts.length === 0) {
      return;
    }

    // Refresh history for all monitored networks
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

  return {
    filteredTxs,
    pendingCount: filteredTxs.length,
    refreshPending: refreshPendingWithHistory,
  };
};
