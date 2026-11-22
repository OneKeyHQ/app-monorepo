import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { debounce } from 'lodash';
import pTimeout from 'p-timeout';

import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';
import networkUtils from '@onekeyhq/shared/src/utils/networkUtils';
import timerUtils from '@onekeyhq/shared/src/utils/timerUtils';
import { EAvailableAssetsTypeEnum } from '@onekeyhq/shared/types/earn';
import type { IAccountHistoryTx } from '@onekeyhq/shared/types/history';
import type { IStakeTag } from '@onekeyhq/shared/types/staking';
import { EReplaceTxType } from '@onekeyhq/shared/types/tx';

import { useActiveAccount } from '../../../states/jotai/contexts/accountSelector';
import { useEarnAtom } from '../../../states/jotai/contexts/earn';
import { shouldInvalidateAccountScopedData } from '../../../utils/accountUpdate';
import { useCommittedEarnScopeGuard } from '../../Staking/hooks/useCommittedEarnScopeGuard';
import { buildLocalTxStatusSyncId } from '../../Staking/utils/utils';
import { normalizeTaskAccountAddress } from '../tasks/taskAddress';
import { earnPortfolioAccountScope } from '../utils/portfolioAccountScope';

import { resolveStakingPendingTxAccountOwnership } from './stakingPendingTxAccountOwnership';

export type IStakePendingTx = IAccountHistoryTx &
  Required<Pick<IAccountHistoryTx, 'stakingInfo'>>;

type INetworkAccountMeta = {
  accountId: string;
  accountAddress: string;
  xpub?: string;
};

// Distinguishes "this wallet has no account on that network" from "the
// account query failed". Accounts are created per network on demand, so a
// wallet legitimately has none on most chains; nothing can be pending on an
// account that does not exist, while a failed query leaves it unknown.
type INetworkAccountResolution = {
  map: Record<string, string>;
  isComplete: boolean;
};

const EMPTY_NETWORK_ACCOUNT_RESOLUTION: INetworkAccountResolution = {
  map: {},
  isComplete: false,
};
const EMPTY_ACCOUNT_META: Record<string, INetworkAccountMeta> = {};

const ACCOUNTS_ADDED_REFRESH_DELAY_MS = 300;
const PENDING_HISTORY_TIMEOUT_MS = 15_000;

type IRequestFlights<T> = {
  pending: Set<Promise<T>>;
  timedOut: boolean;
};

function avoidTimedOutOverlap<T>(
  flights: Map<string, IRequestFlights<T>>,
  key: string,
  start: () => Promise<T>,
): Promise<T> {
  const existing = flights.get(key);
  if (existing?.timedOut)
    return Promise.reject(new Error('Request is still pending'));
  const entry = existing ?? { pending: new Set<Promise<T>>(), timedOut: false };
  const pending = start();
  entry.pending.add(pending);
  flights.set(key, entry);
  const timeout = setTimeout(() => {
    entry.timedOut = true;
  }, PENDING_HISTORY_TIMEOUT_MS);
  const clear = () => {
    clearTimeout(timeout);
    entry.pending.delete(pending);
    if (entry.pending.size === 0 && flights.get(key) === entry)
      flights.delete(key);
  };
  void pending.then(clear, clear);
  return pending;
}

// A network account created while these hooks are mounted changes none of
// their inputs, so the account map has to be told. `AddDBAccountsToWallet` is
// what the local DB emits for every account row it adds, deriving a chain for
// an existing wallet included; `AccountUpdate` covers imported, watching and
// external accounts. A hardware wallet adds its default accounts in a series,
// hence the trailing debounce.
function useRefreshWhenAccountsAreAdded({
  refresh,
  indexedAccountId,
  isEnabled = true,
}: {
  refresh: () => unknown;
  indexedAccountId: string | undefined;
  isEnabled?: boolean;
}) {
  const refreshRef = useRef(refresh);
  refreshRef.current = refresh;
  const walletId = indexedAccountId
    ? accountUtils.parseIndexedAccountId({ indexedAccountId }).walletId
    : undefined;
  useEffect(() => {
    if (!isEnabled) {
      return undefined;
    }
    const run = debounce(
      () => {
        void refreshRef.current();
      },
      ACCOUNTS_ADDED_REFRESH_DELAY_MS,
      { leading: false, trailing: true },
    );
    const onAccountsAdded = (payload?: { walletId?: string }) => {
      if (walletId && payload?.walletId && payload.walletId !== walletId) {
        return;
      }
      run();
    };
    const onAccountUpdate = () => {
      run();
    };
    appEventBus.on(EAppEventBusNames.AddDBAccountsToWallet, onAccountsAdded);
    appEventBus.on(EAppEventBusNames.AccountUpdate, onAccountUpdate);
    return () => {
      appEventBus.off(EAppEventBusNames.AddDBAccountsToWallet, onAccountsAdded);
      appEventBus.off(EAppEventBusNames.AccountUpdate, onAccountUpdate);
      run.cancel();
    };
  }, [walletId, isEnabled]);
}

type IFilteredPendingTxsResult = {
  filteredTxs: IStakePendingTx[];
  isPendingHistoryVerified: boolean;
  pendingHistoryFailedNetworkIds: string[];
  verifiedNetworks: Record<
    string,
    {
      targetKey: string;
      accountId: string;
      accountAddress: string;
      isPending: boolean;
    }
  >;
};

const UNVERIFIED_PENDING_TXS_RESULT: IFilteredPendingTxsResult = {
  filteredTxs: [],
  isPendingHistoryVerified: false,
  pendingHistoryFailedNetworkIds: [],
  verifiedNetworks: {},
};

const VERIFIED_EMPTY_PENDING_TXS_RESULT: IFilteredPendingTxsResult = {
  filteredTxs: [],
  isPendingHistoryVerified: true,
  pendingHistoryFailedNetworkIds: [],
  verifiedNetworks: {},
};

// Precomputed inputs from a co-located parent (e.g. EarnHome) so two
// hook instances do not independently resolve the same data. When omitted
// the hook resolves everything itself — single-caller pages keep the
// legacy behavior unchanged.
//
// `pollingIntervalsByNetwork` is the raw `Record<networkId, seconds>` map
// (NOT the min) so each hook instance computes the min over its own
// account-backed subset — necessary because Earn and Borrow may pick
// different pending-capable networks.
//
// All three fields are keyed by the parent-resolved networks that have an
// account. Hook instances pick their subset. When a key is missing the hook
// falls back to its own resolution path for the affected resolution only.
export type IStakingPendingTxsPrecomputed = {
  networkAccountMap?: Record<string, string>;
  // Networks the parent asked about, which is a superset of the ones that
  // have an account. An instance may short-circuit to the shared map when
  // every network it needs was asked about.
  requestedNetworkIds?: string[];
  isNetworkAccountMapComplete?: boolean;
  pollingIntervalsByNetwork?: Record<string, number>;
  accountMetaByNetwork?: Record<string, INetworkAccountMeta>;
};

const DEFAULT_POLLING_INTERVAL = timerUtils.getTimeDurationMs({ seconds: 30 });

/**
 * Wait before refreshing once the pending transactions have cleared. The tx
 * tracker reports success up to a block before the node the figures are
 * computed from; a refresh fired in that gap fetches, and the server caches,
 * the pre-transaction balance (OK-63659).
 */
export const STAKING_TX_SETTLE_DELAY_MS = timerUtils.getTimeDurationMs({
  seconds: 3,
});

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
  const [accountRevision, setAccountRevision] = useState(0);
  const revisionRef = useRef(0);
  const completionTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    const onAccountUpdate = (payload: unknown) => {
      if (shouldInvalidateAccountScopedData(payload)) {
        revisionRef.current += 1;
        if (completionTimerRef.current) {
          clearTimeout(completionTimerRef.current);
          completionTimerRef.current = null;
        }
        setAccountRevision((revision) => revision + 1);
      }
    };
    appEventBus.on(EAppEventBusNames.AccountUpdate, onAccountUpdate);
    return () => {
      appEventBus.off(EAppEventBusNames.AccountUpdate, onAccountUpdate);
    };
  }, []);
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

  const ownerScope = JSON.stringify([accountId, networkId, stakeTag]);
  const ownerScopeRef = useRef(ownerScope);
  ownerScopeRef.current = ownerScope;
  const pendingScope = JSON.stringify([ownerScope, accountRevision]);

  // Keep a pending result bound to the account and network that produced it.
  const { result: pendingResult, run: refreshPendingTxs } = usePromiseResult<{
    scope: string;
    txs: IStakePendingTx[];
    identity?: string;
  }>(
    async () => {
      if (!accountId || !stakeTag) {
        return { scope: pendingScope, txs: [] };
      }
      const result =
        await backgroundApiProxy.serviceStaking.fetchLocalStakingHistoryWithAccount(
          {
            accountId,
            networkId,
            stakeTag,
          },
        );
      return {
        scope: pendingScope,
        txs: result.txs,
        identity: result.accountIdentity,
      };
    },
    [accountId, networkId, stakeTag, pendingScope],
    {
      initResult: { scope: '', txs: [] },
      revalidateOnFocus: true,
    },
  );

  const txs = pendingResult?.scope === pendingScope ? pendingResult.txs : [];
  const isPending = txs.length > 0;
  const previousPendingRef = useRef<
    | {
        ownerScope: string;
        identity: string;
        isPending: boolean;
      }
    | undefined
  >(undefined);
  const completionRef = useRef<
    | {
        ownerScope: string;
        identity: string;
        deadline: number;
      }
    | undefined
  >(undefined);

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
    if (completionTimerRef.current) {
      clearTimeout(completionTimerRef.current);
      completionTimerRef.current = null;
    }
    if (completionRef.current?.ownerScope !== ownerScope) {
      completionRef.current = undefined;
    }
    if (previousPendingRef.current?.ownerScope !== ownerScope) {
      previousPendingRef.current = undefined;
    }
    if (pendingResult?.scope !== pendingScope || !pendingResult.identity) {
      return;
    }
    const identity = pendingResult.identity;
    const previous = previousPendingRef.current;
    if (completionRef.current?.identity !== identity || isPending) {
      completionRef.current = undefined;
    }
    if (previous?.identity === identity && previous.isPending && !isPending) {
      completionRef.current = {
        ownerScope,
        identity,
        deadline: Date.now() + STAKING_TX_SETTLE_DELAY_MS,
      };
    }
    previousPendingRef.current = { ownerScope, identity, isPending };
    const completion = completionRef.current;
    if (completion) {
      const revision = revisionRef.current;
      completionTimerRef.current = setTimeout(
        () => {
          completionTimerRef.current = null;
          if (
            revisionRef.current === revision &&
            ownerScopeRef.current === completion.ownerScope &&
            completionRef.current === completion
          ) {
            completionRef.current = undefined;
            onRefreshRef.current?.();
          }
        },
        Math.max(0, completion.deadline - Date.now()),
      );
    }
  }, [isPending, ownerScope, pendingResult, pendingScope]);

  useEffect(
    () => () => {
      if (completionTimerRef.current) {
        clearTimeout(completionTimerRef.current);
      }
    },
    [],
  );

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
  revalidateOnFocus = true,
  isActive = true,
  accountId: explicitAccountId,
  indexedAccountId: explicitIndexedAccountId,
  networkAccountTargets,
  activationScope,
}: {
  filter?: (tx: IStakePendingTx) => boolean;
  onRefresh?: () => void | Promise<void>;
  networkIds?: string[];
  tagMatcher?: (tag: string) => boolean;
  onRefreshDelayMs?: number;
  precomputed?: IStakingPendingTxsPrecomputed;
  revalidateOnFocus?: boolean;
  // For hosts that keep this hook mounted while its surface is hidden inside
  // a focused route, where route focus alone never parks the work.
  isActive?: boolean;
  accountId?: string;
  indexedAccountId?: string;
  networkAccountTargets?: Record<
    string,
    { accountId: string; accountAddress: string } | null
  >;
  activationScope?: object;
}) => {
  const { activeAccount } = useActiveAccount({ num: 0 });
  const { account, indexedAccount } = activeAccount;
  const metadataFlights = useRef(
    new Map<
      string,
      IRequestFlights<
        Awaited<
          ReturnType<
            typeof backgroundApiProxy.serviceAccount.getAccountMetaForNetworksBatch
          >
        >
      >
    >(),
  );
  const historyFlights = useRef(
    new Map<
      string,
      IRequestFlights<
        Awaited<
          ReturnType<
            typeof backgroundApiProxy.serviceHistory.fetchAccountHistory
          >
        >
      >
    >(),
  );
  const localHistoryFlights = useRef(
    new Map<
      string,
      IRequestFlights<
        Awaited<
          ReturnType<
            typeof backgroundApiProxy.serviceHistory.getAccountLocalHistoryPendingTxs
          >
        >
      >
    >(),
  );
  const activeAccountId = account?.id;
  const activeIndexedAccountId = indexedAccount?.id;
  const activeNetworkId = activeAccount.network?.id;
  const [{ availableAssetsByType = {} }] = useEarnAtom();
  const shouldUseEarnAssets = !tagMatcher;
  const lastVerifiedPendingTxsByTargetRef = useRef<
    Map<string, { requestId: number; pendingTxs: IAccountHistoryTx[] }>
  >(new Map());
  const pendingHistoryRequestIdRef = useRef(0);
  const completionTimersRef = useRef(
    new Map<string, ReturnType<typeof setTimeout>>(),
  );
  const completionInFlightRef = useRef(0);
  const mountedRef = useRef(true);
  const [isCompletionRevalidating, setIsCompletionRevalidating] =
    useState(false);
  const completionRefreshGenerationRef = useRef(0);

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
            `${protocol.networkId}-${protocol.provider}-${protocol.vault ?? ''}`,
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
      asset.protocols?.forEach(({ networkId, provider, vault }) => {
        if (!networkId || !provider) {
          return;
        }
        const stakeTag = buildLocalTxStatusSyncId({
          providerName: provider,
          tokenSymbol: asset.symbol,
          protocolVault: vault,
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

  const stableNetworkIdsKey = useMemo(
    () => [...new Set((networkIds ?? []).filter(Boolean))].toSorted().join('|'),
    [networkIds],
  );
  const explicitNetworkIds = useMemo(
    () => (stableNetworkIdsKey ? stableNetworkIdsKey.split('|') : []),
    [stableNetworkIdsKey],
  );
  const hasExplicitNetworkIds = Boolean(networkIds?.length);
  const effectiveNetworkIds = hasExplicitNetworkIds
    ? explicitNetworkIds
    : derivedNetworkIds;

  const {
    accountId,
    indexedAccountId,
    currentNetworkId,
    hasExplicitOwnership,
  } = resolveStakingPendingTxAccountOwnership({
    activeAccountId,
    activeIndexedAccountId,
    activeNetworkId,
    accountId: explicitAccountId,
    indexedAccountId: explicitIndexedAccountId,
    networkIds: effectiveNetworkIds,
  });

  const ownerScope = JSON.stringify([
    accountId,
    indexedAccountId,
    currentNetworkId,
    [...effectiveNetworkIds].toSorted(),
    networkAccountTargets
      ? Object.entries(networkAccountTargets).toSorted(([a], [b]) => {
          if (a < b) return -1;
          if (a > b) return 1;
          return 0;
        })
      : undefined,
    !hasExplicitOwnership || accountId === activeAccountId
      ? earnPortfolioAccountScope({
          account,
          indexedAccountId: activeIndexedAccountId,
        })
      : undefined,
  ]);

  // Resolve network-specific accountIds for the selected account owner.
  // Short-circuit to the parent-precomputed union map when present —
  // EarnHome's earn + borrow hook instances share one resolution this way.
  const networkAccountResult = usePromiseResult<{
    scope: string;
    resolution: INetworkAccountResolution;
  }>(
    async () => {
      if (networkAccountTargets) {
        const map: Record<string, string> = {};
        for (const networkId of effectiveNetworkIds) {
          const target = networkAccountTargets[networkId];
          if (target?.accountId && target.accountAddress) {
            map[networkId] = target.accountId;
          }
        }
        return {
          scope: ownerScope,
          resolution: {
            map,
            isComplete: effectiveNetworkIds.every((networkId) =>
              Boolean(map[networkId]),
            ),
          },
        };
      }
      const sharedMap = hasExplicitOwnership
        ? undefined
        : precomputed?.networkAccountMap;
      if (sharedMap) {
        const subset: Record<string, string> = {};
        for (const networkId of effectiveNetworkIds) {
          const accountForNetwork = sharedMap[networkId];
          if (accountForNetwork) {
            subset[networkId] = accountForNetwork;
          }
        }
        // The parent must have ASKED about every effectiveNetworkId; it does
        // not have to have found an account for each. Requiring an account per
        // network kept the short-circuit off for every wallet that has not
        // derived one on some Earn chain — that is most of them — so both
        // EarnHome instances paid their own resolution anyway. Without the
        // parent's requested list (a hand-built precomputed), keep the legacy
        // full-coverage rule.
        const requestedNetworkIds = precomputed?.requestedNetworkIds;
        const parentCoversEveryNetwork = requestedNetworkIds
          ? effectiveNetworkIds.every((networkId) =>
              requestedNetworkIds.includes(networkId),
            )
          : Object.keys(subset).length === effectiveNetworkIds.length;
        if (
          parentCoversEveryNetwork &&
          precomputed?.isNetworkAccountMapComplete !== false
        ) {
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
          return {
            scope: ownerScope,
            resolution: { map: subset, isComplete: true },
          };
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

      if (!indexedAccountId || effectiveNetworkIds.length === 0) {
        // An owner without an indexed account can only ever hold the current
        // network's account, so the map is as complete as it can get.
        return { scope: ownerScope, resolution: { map, isComplete: true } };
      }

      let isComplete = true;
      try {
        const accounts =
          await backgroundApiProxy.serviceAccount.getNetworkAccountsInSameIndexedAccountId(
            {
              indexedAccountId,
              networkIds: effectiveNetworkIds,
            },
          );

        accounts.forEach(({ network, account: networkAccount }) => {
          if (network?.id && networkAccount?.id) {
            map[network.id] = networkAccount.id;
          }
        });
      } catch {
        // Best-effort account resolution; keep whatever we have, and record
        // that an absent network here means unknown rather than no account.
        isComplete = false;
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
                  indexedAccountId,
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

      return { scope: ownerScope, resolution: { map, isComplete } };
    },
    [
      accountId,
      ownerScope,
      currentNetworkId,
      indexedAccountId,
      effectiveNetworkIds,
      hasExplicitOwnership,
      precomputed?.networkAccountMap,
      precomputed?.requestedNetworkIds,
      precomputed?.isNetworkAccountMapComplete,
      networkAccountTargets,
    ],
    {
      initResult: { scope: '', resolution: EMPTY_NETWORK_ACCOUNT_RESOLUTION },
      watchLoading: true,
    },
  );
  const {
    result: scopedNetworkAccountResolution,
    isLoading: networkAccountMapLoading,
    run: refreshNetworkAccountMap,
  } = networkAccountResult;
  const networkAccountResolution =
    scopedNetworkAccountResolution.scope === ownerScope
      ? scopedNetworkAccountResolution.resolution
      : EMPTY_NETWORK_ACCOUNT_RESOLUTION;
  const networkAccountMap = networkAccountResolution.map;
  const isNetworkAccountMapComplete = networkAccountResolution.isComplete;
  const accountMetaScope = JSON.stringify([
    ownerScope,
    Object.entries(networkAccountMap).toSorted(),
  ]);

  // This is what the retry of an unverified result used to provide by running
  // every few seconds. With `precomputed` the parent listens instead: its new
  // map is a dependency above, so one event costs one round of lookups.
  useRefreshWhenAccountsAreAdded({
    refresh: () => refreshNetworkAccountMap({ alwaysSetState: true }),
    indexedAccountId,
    isEnabled: !precomputed,
  });

  const pendingNetworkIds = useMemo(
    () => Object.keys(networkAccountMap).sort(),
    [networkAccountMap],
  );

  // Get the minimum polling interval only for networks that have a resolved
  // account. Pending/history is account-scoped; probing vault settings for
  // every Earn-supported network on an empty cold start loads heavy chain
  // capability chunks with no pending txs to poll.
  const { result: pollingInterval } = usePromiseResult(
    async () => {
      if (pendingNetworkIds.length === 0) return DEFAULT_POLLING_INTERVAL;
      const shared = precomputed?.pollingIntervalsByNetwork;
      // Use shared map when the parent has resolved every network we need;
      // otherwise fall back to a batched RPC for the account-backed set only.
      const haveAll =
        shared !== undefined &&
        pendingNetworkIds.every((nid) => shared[nid] !== undefined);
      const intervalsMap = haveAll
        ? shared
        : await backgroundApiProxy.serviceStaking.getFetchHistoryPollingIntervalsBatch(
            { networkIds: pendingNetworkIds },
          );
      const intervals = pendingNetworkIds.map(
        (networkId) => intervalsMap[networkId] ?? 30,
      );
      const minInterval = intervals.length > 0 ? Math.min(...intervals) : 30;
      return timerUtils.getTimeDurationMs({ seconds: minInterval });
    },
    [pendingNetworkIds, precomputed?.pollingIntervalsByNetwork],
    { initResult: DEFAULT_POLLING_INTERVAL },
  );

  // Resolve xpub + accountAddress for every (accountId, networkId) pair.
  // Resolve each network independently so a stalled chain cannot block others.
  const accountMetaResult = usePromiseResult<{
    scope: string;
    meta: Record<string, INetworkAccountMeta>;
  }>(
    async () => {
      const entries = Object.entries(networkAccountMap);
      if (entries.length === 0) {
        return { scope: accountMetaScope, meta: EMPTY_ACCOUNT_META };
      }

      // Reuse precomputed parent meta where available so two co-located
      // hook instances (EarnHome's earn + borrow) share one batch RPC.
      // We still derive the per-instance `meta` map keyed by accountId
      // so downstream pendingTx fetch picks the right account per network.
      const sharedMeta =
        hasExplicitOwnership || networkAccountTargets
          ? undefined
          : precomputed?.accountMetaByNetwork;
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
        await Promise.all(
          missingPairs.map(
            async ({ accountId: accountForNetwork, networkId }) => {
              try {
                const batchResult = await pTimeout(
                  avoidTimedOutOverlap(
                    metadataFlights.current,
                    JSON.stringify([
                      accountMetaScope,
                      accountForNetwork,
                      networkId,
                    ]),
                    () =>
                      backgroundApiProxy.serviceAccount.getAccountMetaForNetworksBatch(
                        {
                          pairs: [{ accountId: accountForNetwork, networkId }],
                        },
                      ),
                  ),
                  { milliseconds: PENDING_HISTORY_TIMEOUT_MS },
                );
                const entry = batchResult[networkId];
                const expected = networkAccountTargets?.[networkId];
                if (
                  entry &&
                  (!networkAccountTargets ||
                    (expected &&
                      normalizeTaskAccountAddress(
                        networkId,
                        entry.accountAddress,
                      ) ===
                        normalizeTaskAccountAddress(
                          networkId,
                          expected.accountAddress,
                        )))
                ) {
                  meta[networkId] = {
                    accountId: accountForNetwork,
                    accountAddress: entry.accountAddress,
                    xpub: entry.xpub,
                  };
                }
              } catch {
                // This network remains unverified without blocking healthy networks.
              }
            },
          ),
        );
      }

      return { scope: accountMetaScope, meta };
    },
    [
      networkAccountMap,
      accountMetaScope,
      hasExplicitOwnership,
      precomputed?.accountMetaByNetwork,
      networkAccountTargets,
    ],
    {
      initResult: { scope: '', meta: EMPTY_ACCOUNT_META },
      watchLoading: true,
    },
  );
  const { result: scopedAccountMeta, isLoading: accountMetaLoading } =
    accountMetaResult;
  const accountMetaByNetwork =
    scopedAccountMeta.scope === accountMetaScope
      ? scopedAccountMeta.meta
      : EMPTY_ACCOUNT_META;
  const pendingCacheScope = useCommittedEarnScopeGuard(
    JSON.stringify([
      accountMetaScope,
      Object.entries(accountMetaByNetwork).toSorted(),
    ]),
  );

  // Fetch pending transactions based on stake tags or tag matcher
  const fetchFilteredPendingTxs =
    useCallback(async (): Promise<IFilteredPendingTxsResult> => {
      pendingHistoryRequestIdRef.current += 1;
      const requestId = pendingHistoryRequestIdRef.current;
      const isCacheScopeCurrent = pendingCacheScope.capture();
      if (effectiveNetworkIds.length === 0) {
        return VERIFIED_EMPTY_PENDING_TXS_RESULT;
      }

      if (!tagMatcher && Object.keys(stakeTagsByNetwork).length === 0) {
        return VERIFIED_EMPTY_PENDING_TXS_RESULT;
      }

      const expectedNetworkIds = effectiveNetworkIds.filter((networkId) => {
        if (tagMatcher) {
          return true;
        }
        return Boolean(stakeTagsByNetwork[networkId]?.size);
      });
      if (expectedNetworkIds.length === 0) {
        return VERIFIED_EMPTY_PENDING_TXS_RESULT;
      }
      // A complete resolution that found no account on a network means there
      // is no account to have pending transactions on, so it is not a gap in
      // what we know. Callers that name an account and a single network keep
      // failing closed: their account must exist for the position they guard.
      const treatMissingAccountAsFailure =
        hasExplicitOwnership || !isNetworkAccountMapComplete;
      const missingNetworkAccountIds = treatMissingAccountAsFailure
        ? expectedNetworkIds.filter(
            (networkId) => !networkAccountMap[networkId],
          )
        : [];
      const resolvedNetworkIds = expectedNetworkIds.filter(
        (networkId) => networkAccountMap[networkId],
      );
      const missingAccountMetaNetworkIds = expectedNetworkIds.filter(
        (networkId) =>
          networkAccountMap[networkId] && !accountMetaByNetwork[networkId],
      );
      const targetsWithAccount: Array<[string, INetworkAccountMeta]> = [];
      resolvedNetworkIds.forEach((networkId) => {
        const meta = accountMetaByNetwork[networkId];
        if (meta) {
          targetsWithAccount.push([networkId, meta]);
        }
      });

      const txsForTargets = await Promise.all(
        targetsWithAccount.map(async ([networkId, meta]) => {
          const targetKey = [
            networkId,
            meta.accountId,
            meta.accountAddress,
            meta.xpub ?? '',
          ].join('|');
          try {
            const pendingTxs = await pTimeout(
              avoidTimedOutOverlap(
                localHistoryFlights.current,
                JSON.stringify([
                  networkId,
                  meta.accountId,
                  meta.accountAddress,
                  meta.xpub,
                ]),
                () =>
                  backgroundApiProxy.serviceHistory.getAccountLocalHistoryPendingTxs(
                    {
                      networkId,
                      accountAddress: meta.accountAddress,
                      xpub: meta.xpub,
                    },
                  ),
              ),
              { milliseconds: PENDING_HISTORY_TIMEOUT_MS },
            );

            return {
              networkId,
              accountId: meta.accountId,
              accountAddress: meta.accountAddress,
              targetKey,
              ok: true as const,
              pendingTxs,
            };
          } catch {
            return {
              networkId,
              accountId: meta.accountId,
              accountAddress: meta.accountAddress,
              targetKey,
              ok: false as const,
            };
          }
        }),
      );

      const failedNetworkIds = [
        ...new Set([
          ...missingNetworkAccountIds,
          ...missingAccountMetaNetworkIds,
          ...txsForTargets
            .filter((result) => !result.ok)
            .map((result) => result.networkId),
        ]),
      ].toSorted();
      const verifiedNetworks: IFilteredPendingTxsResult['verifiedNetworks'] =
        {};
      const allTxs = txsForTargets.flatMap((result) => {
        const pendingTxs = result.ok
          ? result.pendingTxs
          : (lastVerifiedPendingTxsByTargetRef.current.get(result.targetKey)
              ?.pendingTxs ?? []);
        const cached = lastVerifiedPendingTxsByTargetRef.current.get(
          result.targetKey,
        );
        if (
          result.ok &&
          isCacheScopeCurrent() &&
          (!cached || requestId >= cached.requestId)
        ) {
          lastVerifiedPendingTxsByTargetRef.current.set(result.targetKey, {
            requestId,
            pendingTxs: result.pendingTxs,
          });
        }

        const matches = pendingTxs
          .filter((tx): tx is IStakePendingTx => {
            if (tx.replacedType === EReplaceTxType.Cancel) return false;
            if (!tx.stakingInfo) return false;
            const tags = tx.stakingInfo.tags ?? [];
            if (tags.length === 0) return false;
            if (tagMatcher) {
              return tags.some((tag) => tagMatcher(tag));
            }
            const stakeTags = stakeTagsByNetwork[result.networkId];
            if (!stakeTags?.size) return false;
            return tags.some((tag) => stakeTags.has(tag));
          })
          .map((tx) =>
            tx.decodedTx && tx.decodedTx.accountId !== result.accountId
              ? {
                  ...tx,
                  decodedTx: { ...tx.decodedTx, accountId: result.accountId },
                }
              : tx,
          )
          .filter((tx) => !filter || filter(tx));
        if (result.ok) {
          verifiedNetworks[result.networkId] = {
            targetKey: result.targetKey,
            accountId: result.accountId,
            accountAddress: result.accountAddress,
            isPending: matches.length > 0,
          };
        }
        return matches;
      });

      return {
        filteredTxs: allTxs,
        isPendingHistoryVerified: failedNetworkIds.length === 0,
        pendingHistoryFailedNetworkIds: failedNetworkIds,
        verifiedNetworks,
      };
    }, [
      accountMetaByNetwork,
      effectiveNetworkIds,
      filter,
      hasExplicitOwnership,
      isNetworkAccountMapComplete,
      networkAccountMap,
      pendingCacheScope,
      stakeTagsByNetwork,
      tagMatcher,
    ]);

  // Park the per-network history lookups and the retry poll through the same
  // gate a blurred route uses, so both resume once the surface is shown again.
  const overrideIsFocused = useCallback(
    (isFocused: boolean) => isFocused && isActive,
    [isActive],
  );
  const pendingScopeKey = JSON.stringify([
    accountMetaScope,
    Object.entries(accountMetaByNetwork).toSorted(),
  ]);
  const pendingScope = useMemo(
    () => ({ key: pendingScopeKey, filter, tagMatcher, activationScope }),
    [pendingScopeKey, filter, tagMatcher, activationScope],
  );
  const {
    result: scopedPendingTxsResult,
    run: refreshPendingTxs,
    isLoading: filteredTxsLoading,
  } = usePromiseResult<{
    scope: typeof pendingScope | undefined;
    result: IFilteredPendingTxsResult;
  }>(
    async () => ({
      scope: pendingScope,
      result: await fetchFilteredPendingTxs(),
    }),
    [fetchFilteredPendingTxs, pendingScope],
    {
      initResult: { scope: undefined, result: UNVERIFIED_PENDING_TXS_RESULT },
      revalidateOnFocus,
      overrideIsFocused,
      watchLoading: true,
    },
  );
  const pendingTxsResult =
    scopedPendingTxsResult.scope === pendingScope
      ? scopedPendingTxsResult.result
      : UNVERIFIED_PENDING_TXS_RESULT;
  const {
    filteredTxs,
    isPendingHistoryVerified,
    pendingHistoryFailedNetworkIds,
    verifiedNetworks,
  } = pendingTxsResult;
  const pendingHistoryFailureKey = pendingHistoryFailedNetworkIds.join('|');
  const isPendingHistoryVerifiedRef = useRef(isPendingHistoryVerified);
  const networkAccountMapRef = useRef(networkAccountMap);
  const verifiedNetworksRef = useRef(verifiedNetworks);
  isPendingHistoryVerifiedRef.current = isPendingHistoryVerified;
  networkAccountMapRef.current = networkAccountMap;
  verifiedNetworksRef.current = verifiedNetworks;

  const isPending = filteredTxs.length > 0;
  const completionOwnerKey = JSON.stringify([
    accountId,
    indexedAccountId,
    !hasExplicitOwnership || accountId === activeAccountId
      ? earnPortfolioAccountScope({
          account,
          indexedAccountId: activeIndexedAccountId,
        })
      : undefined,
  ]);
  const completionScope = useMemo(
    () => ({ key: completionOwnerKey, filter, tagMatcher }),
    [completionOwnerKey, filter, tagMatcher],
  );
  const previousPendingRef = useRef<{
    scope: typeof completionScope;
    networks: IFilteredPendingTxsResult['verifiedNetworks'];
  }>({ scope: completionScope, networks: {} });
  useEffect(() => {
    const previous = previousPendingRef.current;
    const scopeChanged = previous.scope !== completionScope;
    if (scopeChanged) {
      completionRefreshGenerationRef.current += 1;
      completionTimersRef.current.forEach(clearTimeout);
      completionTimersRef.current.clear();
      completionInFlightRef.current = 0;
      setIsCompletionRevalidating(false);
      previousPendingRef.current = { scope: completionScope, networks: {} };
    }
    const observed = previousPendingRef.current.networks;
    const cancelTimer = (networkId: string) => {
      const timer = completionTimersRef.current.get(networkId);
      if (timer) clearTimeout(timer);
      completionTimersRef.current.delete(networkId);
    };
    for (const [networkId, prior] of Object.entries(observed)) {
      const target = networkAccountTargets?.[networkId];
      if (
        !effectiveNetworkIds.includes(networkId) ||
        (networkAccountTargets &&
          (!target ||
            target.accountId !== prior.accountId ||
            normalizeTaskAccountAddress(networkId, target.accountAddress) !==
              normalizeTaskAccountAddress(networkId, prior.accountAddress))) ||
        (networkAccountMap[networkId] &&
          networkAccountMap[networkId] !== prior.accountId)
      ) {
        delete observed[networkId];
        cancelTimer(networkId);
      }
    }
    const newlySettled: string[] = [];
    for (const [networkId, current] of Object.entries(verifiedNetworks)) {
      const prior = observed[networkId];
      if (prior && prior.targetKey !== current.targetKey) {
        cancelTimer(networkId);
      } else if (current.isPending) {
        cancelTimer(networkId);
      } else if (prior?.isPending) {
        newlySettled.push(networkId);
      }
      observed[networkId] = current;
    }
    if (!completionTimersRef.current.size && !completionInFlightRef.current) {
      setIsCompletionRevalidating(false);
    }
    newlySettled.forEach((networkId) => {
      cancelTimer(networkId);
      const attempt = completionRefreshGenerationRef.current;
      setIsCompletionRevalidating(true);
      const refreshAfterPending = async () => {
        completionTimersRef.current.delete(networkId);
        completionInFlightRef.current += 1;
        try {
          const refresh = onRefreshRef.current?.();
          if (refresh) {
            await pTimeout(Promise.resolve(refresh), {
              milliseconds: PENDING_HISTORY_TIMEOUT_MS,
            });
          }
        } catch {
          // Best-effort refresh; pending history remains the durable guard.
        } finally {
          if (attempt === completionRefreshGenerationRef.current) {
            completionInFlightRef.current -= 1;
            if (
              mountedRef.current &&
              !completionInFlightRef.current &&
              !completionTimersRef.current.size
            ) {
              setIsCompletionRevalidating(false);
            }
          }
        }
      };
      if (onRefreshDelayMs > 0) {
        const timer = setTimeout(() => {
          void refreshAfterPending();
        }, onRefreshDelayMs);
        completionTimersRef.current.set(networkId, timer);
      } else {
        void refreshAfterPending();
      }
    });
  }, [
    completionScope,
    effectiveNetworkIds,
    networkAccountMap,
    networkAccountTargets,
    onRefreshDelayMs,
    verifiedNetworks,
  ]);

  useEffect(() => {
    mountedRef.current = true;
    const timers = completionTimersRef.current;
    return () => {
      mountedRef.current = false;
      completionRefreshGenerationRef.current += 1;
      timers.forEach(clearTimeout);
      timers.clear();
    };
  }, []);

  // Refresh both account history and pending transactions
  const refreshPendingWithHistory = useCallback(async () => {
    const accounts = Object.entries(networkAccountMapRef.current).filter(
      ([networkId]) => Boolean(verifiedNetworksRef.current[networkId]),
    );
    const synchronizeVerifiedNetworks = async () => {
      await Promise.all(
        accounts.map(([networkId, pendingAccountId]) =>
          pTimeout(
            avoidTimedOutOverlap(
              historyFlights.current,
              JSON.stringify([pendingAccountId, networkId]),
              () =>
                backgroundApiProxy.serviceHistory.fetchAccountHistory({
                  accountId: pendingAccountId,
                  networkId,
                }),
            ),
            { milliseconds: PENDING_HISTORY_TIMEOUT_MS },
          ).catch(() => undefined),
        ),
      );
      if (accounts.length) await refreshPendingTxs();
    };
    await Promise.all([
      synchronizeVerifiedNetworks(),
      ...(!isPendingHistoryVerifiedRef.current
        ? [
            pTimeout(refreshNetworkAccountMap({ alwaysSetState: true }), {
              milliseconds: PENDING_HISTORY_TIMEOUT_MS,
            }).catch(() => undefined),
          ]
        : []),
    ]);
  }, [refreshNetworkAccountMap, refreshPendingTxs]);

  // Auto-polling when there are pending transactions
  usePromiseResult(
    async () => {
      if (
        !isPending &&
        isPendingHistoryVerified &&
        pendingHistoryFailureKey.length === 0
      ) {
        return;
      }
      await refreshPendingWithHistory();
    },
    [
      isPending,
      isPendingHistoryVerified,
      pendingHistoryFailureKey,
      refreshPendingWithHistory,
    ],
    {
      pollingInterval,
      overrideIsFocused,
    },
  );

  return {
    filteredTxs,
    pendingCount: filteredTxs.length,
    isPendingHistoryVerified,
    pendingHistoryFailedNetworkIds,
    isLoading:
      networkAccountMapLoading !== false ||
      accountMetaLoading !== false ||
      filteredTxsLoading !== false ||
      (previousPendingRef.current.scope === completionScope &&
        Object.entries(verifiedNetworks).some(([networkId, current]) => {
          const previous = previousPendingRef.current.networks[networkId];
          return (
            previous?.targetKey === current.targetKey &&
            previous.isPending &&
            !current.isPending
          );
        })) ||
      isCompletionRevalidating,
    refreshPending: refreshPendingWithHistory,
  };
};

/**
 * Parent-side resolver that batches the three RPCs every
 * `useStakingPendingTxsByInfo` instance independently issues:
 * - `getNetworkAccountsInSameIndexedAccountId` (account map for union)
 * - `getAccountMetaForNetworksBatch` (xpub + accountAddress per network)
 * - `getFetchHistoryPollingIntervalsBatch` (polling intervals for union)
 *
 * When EarnHome renders both an Earn and a Borrow instance side-by-side,
 * each would otherwise resolve the same union of networks independently.
 * Forwarding this result via `precomputed` shares the resolution.
 *
 * Single-instance callers MUST NOT use this — they already pay only one
 * set of RPCs and adding the wrapper would double the work.
 */
export const useEarnPendingTxsSharedMeta = ({
  extraNetworkIds = [],
}: {
  extraNetworkIds?: string[];
} = {}): IStakingPendingTxsPrecomputed => {
  const metadataFlights = useRef(
    new Map<
      string,
      IRequestFlights<
        Awaited<
          ReturnType<
            typeof backgroundApiProxy.serviceAccount.getAccountMetaForNetworksBatch
          >
        >
      >
    >(),
  );
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
  const ownerScope = JSON.stringify([
    accountId,
    indexedAccount?.id,
    currentNetworkId,
    [...unionNetworkIds].toSorted(),
    earnPortfolioAccountScope({
      account,
      indexedAccountId: indexedAccount?.id,
    }),
  ]);

  // Resolve account-per-network for the union. Mirrors the in-hook
  // resolver — kept aligned so subset short-circuits in
  // useStakingPendingTxsByInfo are byte-identical to a per-instance run.
  const networkAccountResolutionRequest = usePromiseResult<{
    scope: string;
    resolution: INetworkAccountResolution;
  }>(
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
        return { scope: ownerScope, resolution: { map, isComplete: true } };
      }

      let isComplete = true;
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
        // Best-effort; the completeness flag makes instances fall back to
        // their own resolution instead of reading absence as "no account".
        isComplete = false;
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

      return { scope: ownerScope, resolution: { map, isComplete } };
    },
    [
      accountId,
      currentNetworkId,
      indexedAccount?.id,
      unionNetworkIds,
      ownerScope,
    ],
    { initResult: { scope: '', resolution: EMPTY_NETWORK_ACCOUNT_RESOLUTION } },
  );
  const networkAccountResolution =
    networkAccountResolutionRequest.result.scope === ownerScope
      ? networkAccountResolutionRequest.result.resolution
      : EMPTY_NETWORK_ACCOUNT_RESOLUTION;
  const networkAccountMap = networkAccountResolution.map;
  const accountMetaScope = JSON.stringify([
    ownerScope,
    Object.entries(networkAccountMap).toSorted(),
  ]);

  // Instances short-circuit to this map, so their own refresh cannot notice a
  // new account: this is the resolution that has to run again.
  useRefreshWhenAccountsAreAdded({
    refresh: () =>
      networkAccountResolutionRequest.run({ alwaysSetState: true }),
    indexedAccountId: indexedAccount?.id,
  });

  const { result: scopedAccountMeta } = usePromiseResult<{
    scope: string;
    meta: Record<string, INetworkAccountMeta>;
  }>(
    async () => {
      const entries = Object.entries(networkAccountMap);
      if (entries.length === 0) {
        return { scope: accountMetaScope, meta: EMPTY_ACCOUNT_META };
      }
      const meta: Record<string, INetworkAccountMeta> = {};
      await Promise.all(
        entries.map(async ([networkId, accountForNetwork]) => {
          try {
            const batchResult = await pTimeout(
              avoidTimedOutOverlap(
                metadataFlights.current,
                JSON.stringify([
                  accountMetaScope,
                  accountForNetwork,
                  networkId,
                ]),
                () =>
                  backgroundApiProxy.serviceAccount.getAccountMetaForNetworksBatch(
                    {
                      pairs: [{ accountId: accountForNetwork, networkId }],
                    },
                  ),
              ),
              { milliseconds: PENDING_HISTORY_TIMEOUT_MS },
            );
            const entry = batchResult[networkId];
            if (entry) {
              meta[networkId] = {
                accountId: accountForNetwork,
                accountAddress: entry.accountAddress,
                xpub: entry.xpub,
              };
            }
          } catch {
            // Let each network resolve independently when another is unavailable.
          }
        }),
      );
      return { scope: accountMetaScope, meta };
    },
    [networkAccountMap, accountMetaScope],
    { initResult: { scope: '', meta: EMPTY_ACCOUNT_META } },
  );
  const accountMetaByNetwork =
    scopedAccountMeta.scope === accountMetaScope
      ? scopedAccountMeta.meta
      : EMPTY_ACCOUNT_META;

  const { result: pollingIntervalsByNetwork } = usePromiseResult<
    Record<string, number>
  >(
    async () => {
      const networkIds = Object.keys(networkAccountMap);
      if (networkIds.length === 0) return {};
      return backgroundApiProxy.serviceStaking.getFetchHistoryPollingIntervalsBatch(
        { networkIds },
      );
    },
    [networkAccountMap],
    { initResult: {} as Record<string, number> },
  );

  return useMemo<IStakingPendingTxsPrecomputed>(
    () => ({
      networkAccountMap,
      requestedNetworkIds: unionNetworkIds,
      isNetworkAccountMapComplete: networkAccountResolution.isComplete,
      accountMetaByNetwork,
      pollingIntervalsByNetwork,
    }),
    [
      networkAccountMap,
      networkAccountResolution.isComplete,
      unionNetworkIds,
      accountMetaByNetwork,
      pollingIntervalsByNetwork,
    ],
  );
};
