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

// Precomputed inputs from a co-located parent (e.g. EarnHome) so two
// hook instances do not independently resolve the same data. When omitted
// the hook resolves everything itself — single-caller pages keep the
// legacy behavior unchanged.
//
// `pollingIntervalsByNetwork` is the raw `Record<networkId, seconds>` map
// (NOT the min) so each hook instance computes the min over its own
// `effectiveNetworkIds` subset — necessary because Earn and Borrow may
// pick different subsets of the union.
//
// All three fields are keyed by the union of the parent-resolved networks;
// hook instances pick their subset. When a key is missing the hook falls
// back to its own resolution path for the affected resolution only.
export type IStakingPendingTxsPrecomputed = {
  networkAccountMap?: Record<string, string>;
  pollingIntervalsByNetwork?: Record<string, number>;
  accountMetaByNetwork?: Record<string, INetworkAccountMeta>;
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
  precomputed,
}: {
  filter?: (tx: IStakePendingTx) => boolean;
  onRefresh?: () => void;
  networkIds?: string[];
  tagMatcher?: (tag: string) => boolean;
  onRefreshDelayMs?: number;
  precomputed?: IStakingPendingTxsPrecomputed;
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

  // Get the minimum polling interval across all networks. One batched
  // bridge call instead of N — the legacy `.map(networkId => RPC)` pattern
  // was the 10+/s freeze amplifier called out in the OK-perp/swap trace.
  const { result: pollingInterval } = usePromiseResult(
    async () => {
      if (effectiveNetworkIds.length === 0) return DEFAULT_POLLING_INTERVAL;
      const shared = precomputed?.pollingIntervalsByNetwork;
      // Use shared map when the parent has resolved every network we need;
      // otherwise fall back to a batched RPC for the full set (avoid a
      // partial-cache-miss split that would still cost a bridge call).
      const haveAll =
        shared !== undefined &&
        effectiveNetworkIds.every((nid) => shared[nid] !== undefined);
      const intervalsMap = haveAll
        ? shared
        : await backgroundApiProxy.serviceStaking.getFetchHistoryPollingIntervalsBatch(
            { networkIds: effectiveNetworkIds },
          );
      const intervals = effectiveNetworkIds.map(
        (networkId) => intervalsMap[networkId] ?? 30,
      );
      const minInterval = intervals.length > 0 ? Math.min(...intervals) : 30;
      return timerUtils.getTimeDurationMs({ seconds: minInterval });
    },
    [effectiveNetworkIds, precomputed?.pollingIntervalsByNetwork],
    { initResult: DEFAULT_POLLING_INTERVAL },
  );

  // Resolve network-specific accountIds for the active indexed account.
  // Short-circuit to the parent-precomputed union map when present —
  // EarnHome's earn + borrow hook instances share one resolution this way.
  const { result: networkAccountMap } = usePromiseResult<
    Record<string, string>
  >(
    async () => {
      const sharedMap = precomputed?.networkAccountMap;
      if (sharedMap) {
        const subset: Record<string, string> = {};
        for (const networkId of effectiveNetworkIds) {
          const accountForNetwork = sharedMap[networkId];
          if (accountForNetwork) {
            subset[networkId] = accountForNetwork;
          }
        }
        // Parent must cover every effectiveNetworkId for the short-circuit
        // to be safe; falling back to per-instance resolution preserves the
        // legacy "best-effort" contract when the union missed a network.
        if (Object.keys(subset).length === effectiveNetworkIds.length) {
          // Mirror the fallback path's synchronous activeAccount override so
          // account switches converge one tick faster — without this, the
          // short-circuit would briefly hold the OLD accountId for the
          // current network until the shared resolver re-runs.
          //
          // Skip BTC: sharedMap entries are already normalized to taproot via
          // getEarnAccount({ btcOnlyTaproot: true }) in the precomputed
          // resolver. The active accountId is whichever derivation the user
          // selected (often BIP44/BIP49/BIP84), so overwriting here would
          // undo the taproot normalization and make pending tx fetch +
          // history polling query the wrong account (OK-51703 regression).
          if (
            accountId &&
            currentNetworkId &&
            effectiveNetworkIds.includes(currentNetworkId) &&
            !networkUtils.isBTCNetwork(currentNetworkId)
          ) {
            subset[currentNetworkId] = accountId;
          }
          return subset;
        }
      }

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
    [
      accountId,
      currentNetworkId,
      indexedAccount?.id,
      effectiveNetworkIds,
      precomputed?.networkAccountMap,
    ],
    { initResult: {} },
  );

  // Resolve xpub + accountAddress for every (accountId, networkId) pair.
  // One batched bridge call replaces the prior 2N per-pair fan-out
  // (getAccountXpub + getAccountAddressForApi) — see ServiceAccount
  // .getAccountMetaForNetworksBatch for the contract.
  const { result: accountMetaByNetwork } = usePromiseResult<
    Record<string, INetworkAccountMeta>
  >(
    async () => {
      const entries = Object.entries(networkAccountMap);
      if (entries.length === 0) {
        return {} as Record<string, INetworkAccountMeta>;
      }

      // Reuse precomputed parent meta where available so two co-located
      // hook instances (EarnHome's earn + borrow) share one batch RPC.
      // We still derive the per-instance `meta` map keyed by accountId
      // so downstream pendingTx fetch picks the right account per network.
      const sharedMeta = precomputed?.accountMetaByNetwork;
      const missingPairs: Array<{ accountId: string; networkId: string }> = [];
      const meta: Record<string, INetworkAccountMeta> = {};

      for (const [networkId, accountForNetwork] of entries) {
        const hit = sharedMeta?.[networkId];
        if (hit && hit.accountId === accountForNetwork) {
          meta[networkId] = hit;
        } else {
          missingPairs.push({ accountId: accountForNetwork, networkId });
        }
      }

      if (missingPairs.length > 0) {
        const batchResult =
          await backgroundApiProxy.serviceAccount.getAccountMetaForNetworksBatch(
            { pairs: missingPairs },
          );
        for (const {
          accountId: accountForNetwork,
          networkId,
        } of missingPairs) {
          const entry = batchResult[networkId];
          if (entry) {
            meta[networkId] = {
              accountId: accountForNetwork,
              accountAddress: entry.accountAddress,
              xpub: entry.xpub,
            };
          }
        }
      }

      return meta;
    },
    [networkAccountMap, precomputed?.accountMetaByNetwork],
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

/**
 * Parent-side resolver that batches the three RPCs every
 * `useStakingPendingTxsByInfo` instance independently issues:
 * - `getNetworkAccountsInSameIndexedAccountId` (account map for union)
 * - `getAccountMetaForNetworksBatch` (xpub + accountAddress for union)
 * - `getFetchHistoryPollingIntervalsBatch` (polling intervals for union)
 *
 * When EarnHome renders both an Earn and a Borrow instance side-by-side,
 * each was previously paying its own 3 round-trips on the same union of
 * networks. Calling this hook once at the EarnHome level and forwarding
 * the result via `precomputed` collapses 6 RPCs → 3 RPCs per dep change.
 *
 * Single-instance callers MUST NOT use this — they already pay only one
 * set of RPCs and adding the wrapper would double the work.
 */
export const useEarnPendingTxsSharedMeta = ({
  extraNetworkIds = [],
}: {
  extraNetworkIds?: string[];
} = {}): IStakingPendingTxsPrecomputed => {
  const { activeAccount } = useActiveAccount({ num: 0 });
  const { account, indexedAccount } = activeAccount;
  const accountId = account?.id;
  const currentNetworkId = activeAccount.network?.id;
  const [{ availableAssetsByType = {} }] = useEarnAtom();

  // Same derivation chain as inside useStakingPendingTxsByInfo's Earn
  // branch — kept in sync so the union is a strict superset of what
  // either instance will look up.
  const derivedNetworkIds = useMemo<string[]>(() => {
    const groupedAssets = [
      EAvailableAssetsTypeEnum.SimpleEarn,
      EAvailableAssetsTypeEnum.FixedRate,
      EAvailableAssetsTypeEnum.Staking,
    ].flatMap((type) => availableAssetsByType?.[type] ?? []);
    const mergedAssets =
      groupedAssets.length > 0
        ? groupedAssets
        : Object.values(availableAssetsByType).flat();
    const set = new Set<string>();
    mergedAssets.forEach((asset) => {
      asset.protocols?.forEach((protocol) => {
        if (protocol.networkId) {
          set.add(protocol.networkId);
        }
      });
    });
    return [...set];
  }, [availableAssetsByType]);

  const stableExtraKey = useMemo(
    () => [...new Set(extraNetworkIds.filter(Boolean))].toSorted().join('|'),
    [extraNetworkIds],
  );

  const unionNetworkIds = useMemo<string[]>(() => {
    const cleanedExtras = stableExtraKey ? stableExtraKey.split('|') : [];
    return [...new Set([...derivedNetworkIds, ...cleanedExtras])];
  }, [derivedNetworkIds, stableExtraKey]);

  // Resolve account-per-network for the union. Mirrors the in-hook
  // resolver — kept aligned so subset short-circuits in
  // useStakingPendingTxsByInfo are byte-identical to a per-instance run.
  const { result: networkAccountMap } = usePromiseResult<
    Record<string, string>
  >(
    async () => {
      const map: Record<string, string> = {};

      if (
        accountId &&
        currentNetworkId &&
        unionNetworkIds.includes(currentNetworkId)
      ) {
        map[currentNetworkId] = accountId;
      }

      if (!indexedAccount?.id || unionNetworkIds.length === 0) {
        return map;
      }

      try {
        const accounts =
          await backgroundApiProxy.serviceAccount.getNetworkAccountsInSameIndexedAccountId(
            {
              indexedAccountId: indexedAccount.id,
              networkIds: unionNetworkIds,
            },
          );
        accounts.forEach(({ network, account: networkAccount }) => {
          if (network?.id && networkAccount?.id) {
            map[network.id] = networkAccount.id;
          }
        });
      } catch {
        // Best-effort; downstream consumer falls back to per-instance path
        // for any missing entry.
      }

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
    [accountId, currentNetworkId, indexedAccount?.id, unionNetworkIds],
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
      const pairs = entries.map(([networkId, accountForNetwork]) => ({
        accountId: accountForNetwork,
        networkId,
      }));
      const batchResult =
        await backgroundApiProxy.serviceAccount.getAccountMetaForNetworksBatch({
          pairs,
        });
      const meta: Record<string, INetworkAccountMeta> = {};
      for (const [networkId, accountForNetwork] of entries) {
        const entry = batchResult[networkId];
        if (entry) {
          meta[networkId] = {
            accountId: accountForNetwork,
            accountAddress: entry.accountAddress,
            xpub: entry.xpub,
          };
        }
      }
      return meta;
    },
    [networkAccountMap],
    { initResult: {} as Record<string, INetworkAccountMeta> },
  );

  const { result: pollingIntervalsByNetwork } = usePromiseResult<
    Record<string, number>
  >(
    async () => {
      if (unionNetworkIds.length === 0) return {};
      return backgroundApiProxy.serviceStaking.getFetchHistoryPollingIntervalsBatch(
        { networkIds: unionNetworkIds },
      );
    },
    [unionNetworkIds],
    { initResult: {} as Record<string, number> },
  );

  return useMemo<IStakingPendingTxsPrecomputed>(
    () => ({
      networkAccountMap,
      accountMetaByNetwork,
      pollingIntervalsByNetwork,
    }),
    [networkAccountMap, accountMetaByNetwork, pollingIntervalsByNetwork],
  );
};
