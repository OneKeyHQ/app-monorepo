/**
 * useTokenListReactivePipeline — the main-side all-network LWW orchestration
 *收口 facade (design §2). Encapsulates the unified pipeline that was previously
 * inlined across `TokenListBlock` as 5 refs + 3 closures:
 *   - FloorView = `LwwMaterializedView` (SWR floor + IVM full-overwrite +
 *     intersection-evict + generation guard),
 *   - the merge (`buildMergedAllNetworkSnapshot`), and
 *   - the `ingestRound` feed to the BG `ServiceTokenViewModel`.
 *
 * Boundary (design §2.7): the facade owns ONLY the LWW orchestration; all
 * render-state writes (worth/overview/tokenListState) stay in the component,
 * which calls these methods from thin wrappers. Specifically:
 *   - P0-b: `buildAuthoritativeSnapshot()` RETURNS the built snapshot so the
 *     component can compute `updateAccountWorth(snapshot.accountsWorth…)` before
 *     `commitAuthoritativeIngest(snapshot)` does the ingest + clear + epoch bump.
 *   - P0-a: the cache path keeps `updateTokenListState` in the component AFTER
 *     `await seedAndFlushCache(...)` and inside its `hasAnyCache` guard.
 *   - P0-h: every returned callback is memoised with the SAME dep footprint the
 *     originals had (`account?.id` / `network?.id`), so it is stable within an
 *     owner and changes only on owner switch (matching the original re-fire).
 *   - P1-e: the `flushProgressiveViewRef` indirection is preserved verbatim.
 *   - P1-f: the flush captures the owner once and re-checks a live owner
 *     generation + ownerKey after awaits before writing to the BG VM.
 *   - P1-g: `reset()` clears WITHOUT bumping epoch; `commitAuthoritativeIngest`
 *     clears AND bumps epoch.
 *
 * The single-network `run()` ingest stays in the component: it touches none of
 * these refs (a direct `ingestRound` reading `cellsIngestInputsRef`), so moving
 * it would add risk for no benefit.
 */
import { useCallback, useRef } from 'react';
import type { MutableRefObject } from 'react';

import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { EJotaiContextStoreNames } from '@onekeyhq/kit-bg/src/states/jotai/atoms/jotaiContextStoreMap';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';
import { LwwMaterializedView } from '@onekeyhq/shared/src/utils/lwwMaterializedView';
import type {
  IAccountToken,
  ICustomTokenItem,
  IHomeDefaultToken,
  ITokenFiat,
} from '@onekeyhq/shared/types/token';

import {
  type IAllNetworkSnapshotRound,
  type IMergedAllNetworkSnapshot,
  buildMergedAllNetworkSnapshot,
} from './buildMergedAllNetworkSnapshot';

// L2: coalesce progressive all-network ingests into at most one paint per this
// window, so a 20+ network fan-out yields a few frames (not one per network).
export const PROGRESSIVE_PAINT_THROTTLE_MS = 350;

/**
 * One entry in the all-network LWW-Map materialized view: a
 * `buildMergedAllNetworkSnapshot` round plus the active owner at production time
 * (for the per-paint owner guard) and an `origin` discriminator ('cache' floor
 * seed, already derive-merged → `mergeDeriveAssets:false`; vs 'live' raw result).
 */
export type IProgressiveRound = IAllNetworkSnapshotRound & {
  ownerAccountId?: string;
  ownerNetworkId?: string;
  origin: 'cache' | 'live';
};

/** Owner key + hideZero inputs the `ingestRound` call reads (written in render). */
export interface ICellsIngestInputs {
  ownerKey: string;
  nonZeroInputs: {
    keepDefault?: boolean;
    homeDefaultTokenMap?: Record<string, IHomeDefaultToken>;
    customTokens?: ICustomTokenItem[];
  };
}

/** One per-network LOCAL-cache slice fed to the cache-seed (L1 SWR floor). */
export interface ICacheSeedItem {
  tokenList: IAccountToken[];
  smallBalanceTokenList: IAccountToken[];
  riskyTokenList: IAccountToken[];
  tokenListMap: Record<string, ITokenFiat>;
  aggregateTokenListMap?: { [key: string]: { tokens: IAccountToken[] } };
  aggregateTokenMap?: Record<string, ITokenFiat>;
  accountId: string;
  networkId: string;
}

/** A settled LIVE round (structurally a superset of `IAllNetworkSnapshotRound`). */
export type ILiveRound = IAllNetworkSnapshotRound & {
  accountId?: string;
  networkId?: string;
  ownerAccountId?: string;
  ownerNetworkId?: string;
};

export interface ITokenListReactivePipelineParams {
  ownerAccountId: string | undefined;
  ownerNetworkId: string | undefined;
  ownerCreateAtNetwork: string | undefined;
  /** owner key + hideZero inputs ref (written in render by the component). */
  cellsIngestInputsRef: MutableRefObject<ICellsIngestInputs>;
  /** = ENABLE_BG_TOKEN_VIEW_MODEL — the single unified kill-switch. */
  enabled: boolean;
}

export interface ITokenListReactivePipeline {
  /** Reset the LWW view + drop a pending flush. Does NOT bump epoch (P1-g). */
  reset: () => void;
  /** Seed each per-network cache slice as a FLOOR (L1) then flush immediately. */
  seedAndFlushCache: (args: {
    data: ICacheSeedItem[];
    accountId: string;
    networkId: string;
    generation: number;
  }) => Promise<void>;
  /** Set the authoritative enabled-(account,network)-key set for ∩-evict. */
  setEnabledKeys: (
    accounts: { accountId: string; networkId: string }[],
  ) => void;
  /** LWW-ingest a settled live round (L2) + schedule a throttled flush. */
  ingestLiveRound: (result: ILiveRound, generation: number) => void;
  /** materialize ∩ enabledKeys → resolve merge flags → build the merged snapshot. */
  buildAuthoritativeSnapshot: () => Promise<IMergedAllNetworkSnapshot>;
  /** ingest the authoritative snapshot + clear timer + bump epoch + clear view. */
  commitAuthoritativeIngest: (snapshot: IMergedAllNetworkSnapshot) => void;
}

type IIngestOwnerToken = {
  ownerAccountId: string | undefined;
  ownerNetworkId: string | undefined;
  ownerKey: string;
};

export function useTokenListReactivePipeline(
  params: ITokenListReactivePipelineParams,
): ITokenListReactivePipeline {
  const {
    ownerAccountId,
    ownerNetworkId,
    ownerCreateAtNetwork,
    cellsIngestInputsRef,
    enabled,
  } = params;

  // --- the 5 LWW refs (relocated verbatim from TokenListBlock) ---------------
  const progressiveViewRef = useRef(
    new LwwMaterializedView<IProgressiveRound>(),
  );
  const enabledKeysRef = useRef<Set<string>>(new Set());
  const progressiveFlushTimerRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );
  // P1-e: indirection so `seedAndFlushCache` can drive the shared flush
  // (declared after it) without a hook-ordering / stale-dep cycle.
  const flushProgressiveViewRef = useRef<
    ((source: string) => Promise<void>) | undefined
  >(undefined);
  // H1 epoch guard (P1-g): bumped only by the authoritative commit.
  const progressivePaintEpochRef = useRef(0);
  const ownerIdentityRef = useRef<{
    ownerAccountId: string | undefined;
    ownerNetworkId: string | undefined;
  }>({ ownerAccountId, ownerNetworkId });
  const ownerGenerationRef = useRef(0);
  if (
    ownerIdentityRef.current.ownerAccountId !== ownerAccountId ||
    ownerIdentityRef.current.ownerNetworkId !== ownerNetworkId
  ) {
    ownerIdentityRef.current = { ownerAccountId, ownerNetworkId };
    ownerGenerationRef.current += 1;
  }

  const reset = useCallback(() => {
    if (progressiveFlushTimerRef.current !== null) {
      clearTimeout(progressiveFlushTimerRef.current);
      progressiveFlushTimerRef.current = null;
    }
    progressiveViewRef.current.clear();
  }, []);

  const resolveRoundsWithMergeFlag = useCallback(
    async (rounds: IProgressiveRound[]): Promise<IProgressiveRound[]> => {
      const liveNetworkIds = Array.from(
        new Set(
          rounds
            .filter((r) => r.origin === 'live')
            .map((r) => r.networkId)
            .filter((id): id is string => Boolean(id)),
        ),
      );
      const liveMergeFlagByNetworkId: Record<string, boolean> = {};
      await Promise.all(
        liveNetworkIds.map(async (networkId) => {
          try {
            liveMergeFlagByNetworkId[networkId] = !!(
              await backgroundApiProxy.serviceNetwork.getVaultSettings({
                networkId,
              })
            ).mergeDeriveAssetsEnabled;
          } catch (_e) {
            liveMergeFlagByNetworkId[networkId] = false;
          }
        }),
      );
      return rounds.map((r) =>
        r.origin === 'cache'
          ? r
          : {
              ...r,
              mergeDeriveAssets: r.networkId
                ? liveMergeFlagByNetworkId[r.networkId]
                : false,
            },
      );
    },
    [],
  );

  const ingestMergedSnapshot = useCallback(
    (
      snapshot: IMergedAllNetworkSnapshot,
      source: string,
      ownerToken?: IIngestOwnerToken,
    ) => {
      void backgroundApiProxy.serviceTokenViewModel.ingestRound({
        ownerKey: ownerToken?.ownerKey ?? cellsIngestInputsRef.current.ownerKey,
        orderedTokens: snapshot.orderedTokens,
        smallBalanceTokens: snapshot.smallBalanceTokens,
        tokenListMap: snapshot.mergeTokenListMap,
        aggregateTokensMap: snapshot.aggregateTokenMap,
        ownedAggregateTokenListMap: snapshot.aggregateTokenListMap,
        smallBalanceFiatValue: snapshot.smallBalanceFiatValue,
        storeData: { storeName: EJotaiContextStoreNames.homeTokenList },
        keepDefault: cellsIngestInputsRef.current.nonZeroInputs.keepDefault,
        homeDefaultTokenMap:
          cellsIngestInputsRef.current.nonZeroInputs.homeDefaultTokenMap,
        customTokens: cellsIngestInputsRef.current.nonZeroInputs.customTokens,
        riskyTokens: snapshot.riskyTokens,
        riskyMap: snapshot.riskyTokenListMap,
        accountId: ownerToken?.ownerAccountId ?? ownerAccountId,
        networkId: ownerToken?.ownerNetworkId ?? ownerNetworkId,
        rawKeys: `${snapshot.tokenKeys}_${snapshot.smallBalanceKeys}_${snapshot.riskyKeys}`,
        source,
      });
    },
    [cellsIngestInputsRef, ownerAccountId, ownerNetworkId],
  );

  const flushProgressiveView = useCallback(
    async (source: string) => {
      if (progressiveFlushTimerRef.current !== null) {
        clearTimeout(progressiveFlushTimerRef.current);
        progressiveFlushTimerRef.current = null;
      }
      const epochAtFlushStart = progressivePaintEpochRef.current;
      const ownerGenerationAtFlushStart = ownerGenerationRef.current;
      const ownerTokenAtFlushStart: IIngestOwnerToken = {
        ownerAccountId,
        ownerNetworkId,
        ownerKey: cellsIngestInputsRef.current.ownerKey,
      };
      const rounds = progressiveViewRef.current.materialize(
        enabledKeysRef.current,
      );
      if (!rounds.length || !enabled) {
        return;
      }
      if (
        rounds[0].ownerAccountId !== ownerAccountId ||
        rounds[0].ownerNetworkId !== ownerNetworkId
      ) {
        return;
      }
      const roundsWithFlag = await resolveRoundsWithMergeFlag(rounds);
      if (
        rounds[0].ownerAccountId !== ownerAccountId ||
        rounds[0].ownerNetworkId !== ownerNetworkId
      ) {
        return;
      }
      if (
        ownerGenerationRef.current !== ownerGenerationAtFlushStart ||
        cellsIngestInputsRef.current.ownerKey !==
          ownerTokenAtFlushStart.ownerKey
      ) {
        return;
      }
      if (progressivePaintEpochRef.current !== epochAtFlushStart) {
        return;
      }
      const snapshot = buildMergedAllNetworkSnapshot({
        rounds: roundsWithFlag,
        mergeDeriveAssetsByNetworkId: {},
        accountId: ownerAccountId,
        createAtNetwork: ownerCreateAtNetwork,
      });
      ingestMergedSnapshot(snapshot, source, ownerTokenAtFlushStart);
    },
    [
      ownerAccountId,
      ownerCreateAtNetwork,
      ownerNetworkId,
      cellsIngestInputsRef,
      enabled,
      ingestMergedSnapshot,
      resolveRoundsWithMergeFlag,
    ],
  );

  // P1-e: keep the indirection ref pointing at the latest flush.
  flushProgressiveViewRef.current = flushProgressiveView;

  const seedAndFlushCache = useCallback(
    async ({
      data,
      accountId,
      networkId,
      generation,
    }: {
      data: ICacheSeedItem[];
      accountId: string;
      networkId: string;
      generation: number;
    }) => {
      if (
        !enabled ||
        accountId !== ownerAccountId ||
        networkId !== ownerNetworkId
      ) {
        return;
      }
      for (const item of data) {
        progressiveViewRef.current.seedFloor(
          accountUtils.buildAccountValueKey({
            accountId: item.accountId,
            networkId: item.networkId,
          }),
          {
            networkId: item.networkId,
            accountId: item.accountId,
            tokens: {
              data: item.tokenList,
              keys: item.tokenList.map((t) => t.$key).join(','),
              map: item.tokenListMap,
            },
            smallBalanceTokens: {
              data: item.smallBalanceTokenList,
              keys: item.smallBalanceTokenList.map((t) => t.$key).join(','),
              map: item.tokenListMap,
            },
            riskTokens: {
              data: item.riskyTokenList,
              keys: item.riskyTokenList.map((t) => t.$key).join(','),
              map: item.tokenListMap,
            },
            aggregateTokenListMap: item.aggregateTokenListMap,
            aggregateTokenMap: item.aggregateTokenMap,
            ownerAccountId,
            ownerNetworkId,
            origin: 'cache',
            mergeDeriveAssets: false,
          },
          generation,
        );
      }
      await flushProgressiveViewRef.current?.('cacheSeed');
    },
    [enabled, ownerAccountId, ownerNetworkId],
  );

  const setEnabledKeys = useCallback(
    (accounts: { accountId: string; networkId: string }[]) => {
      enabledKeysRef.current = new Set(
        accounts.map((a) =>
          accountUtils.buildAccountValueKey({
            accountId: a.accountId,
            networkId: a.networkId,
          }),
        ),
      );
    },
    [],
  );

  const ingestLiveRound = useCallback(
    (result: ILiveRound, generation: number) => {
      if (!result) {
        return;
      }
      if (
        result.ownerAccountId !== ownerAccountId ||
        result.ownerNetworkId !== ownerNetworkId
      ) {
        return;
      }
      progressiveViewRef.current.ingest(
        accountUtils.buildAccountValueKey({
          accountId: result.accountId ?? '',
          networkId: result.networkId ?? '',
        }),
        { ...result, origin: 'live' },
        generation,
      );
      if (progressiveFlushTimerRef.current === null) {
        // P1-e indirection (NOT the captured `flushProgressiveView`): on a rapid
        // owner switch the timer must fire the LATEST flush so its owner guard
        // compares the deferred rounds against the CURRENT owner and skips a
        // stale ingest — even when the consumer's `reset()` is delayed past the
        // throttle window. Capturing the closure would re-run the old owner's
        // flush (old owner == old rounds → guard passes → wasted BG ingest).
        progressiveFlushTimerRef.current = setTimeout(() => {
          void flushProgressiveViewRef.current?.('progPaint');
        }, PROGRESSIVE_PAINT_THROTTLE_MS);
      }
    },
    [ownerAccountId, ownerNetworkId],
  );

  const buildAuthoritativeSnapshot =
    useCallback(async (): Promise<IMergedAllNetworkSnapshot> => {
      const viewRounds = progressiveViewRef.current.materialize(
        enabledKeysRef.current,
      );
      const roundsWithFlag = await resolveRoundsWithMergeFlag(viewRounds);
      return buildMergedAllNetworkSnapshot({
        rounds: roundsWithFlag,
        mergeDeriveAssetsByNetworkId: {},
        accountId: ownerAccountId,
        createAtNetwork: ownerCreateAtNetwork,
      });
    }, [ownerAccountId, ownerCreateAtNetwork, resolveRoundsWithMergeFlag]);

  const commitAuthoritativeIngest = useCallback(
    (snapshot: IMergedAllNetworkSnapshot) => {
      if (enabled) {
        ingestMergedSnapshot(snapshot, 'authoritative');
      }
      if (progressiveFlushTimerRef.current !== null) {
        clearTimeout(progressiveFlushTimerRef.current);
        progressiveFlushTimerRef.current = null;
      }
      progressivePaintEpochRef.current += 1;
      progressiveViewRef.current.clear();
    },
    [enabled, ingestMergedSnapshot],
  );

  return {
    reset,
    seedAndFlushCache,
    setEnabledKeys,
    ingestLiveRound,
    buildAuthoritativeSnapshot,
    commitAuthoritativeIngest,
  };
}
