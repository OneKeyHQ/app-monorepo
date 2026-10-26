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
 *     `commitAuthoritativeIngest(snapshot)` does the ingest + epoch bump.
 *   - P0-a: the cache path keeps `updateTokenListState` in the component AFTER
 *     `await seedAndFlushCache(...)` and inside its `hasAnyCache` guard.
 *   - P0-h: returned callbacks are memoised by owner and request validity; the
 *     captured request is checked again after asynchronous work.
 *   - P1-e: the `flushProgressiveViewRef` indirection is preserved verbatim.
 *   - P1-f: the flush captures the owner once and re-checks a live owner
 *     generation + ownerKey after awaits before writing to the BG VM.
 *   - P1-g: `reset()` clears WITHOUT bumping epoch; `commitAuthoritativeIngest`
 *     bumps epoch and keeps the latest rounds as the next refresh's SWR floor.
 *
 * The single-network `run()` ingest stays in the component: it touches none of
 * these refs (a direct `ingestRound` reading `cellsIngestInputsRef`), so moving
 * it would add risk for no benefit.
 */
import { useCallback, useRef } from 'react';
import type { MutableRefObject } from 'react';

import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { EJotaiContextStoreNames } from '@onekeyhq/kit-bg/src/states/jotai/atoms/jotaiContextStoreMap';
import { isRequestCanceledError } from '@onekeyhq/shared/src/errors/utils/errorUtils';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';
import {
  type IAllNetworkSnapshotRound,
  type IMergedAllNetworkSnapshot,
  buildMergedAllNetworkSnapshot,
} from '@onekeyhq/shared/src/utils/buildMergedAllNetworkSnapshot';
import { isHomeTokenRequestCurrent } from '@onekeyhq/shared/src/utils/homeTokenRequest';
import { LwwMaterializedView } from '@onekeyhq/shared/src/utils/lwwMaterializedView';
import type {
  IAccountToken,
  ICustomTokenItem,
  IHomeDefaultToken,
  IHomeTokenRequest,
  ITokenFiat,
} from '@onekeyhq/shared/types/token';

// L2: coalesce progressive all-network ingests into at most one paint per this
// window, so a 20+ network fan-out yields a few frames (not one per network).
export const PROGRESSIVE_PAINT_THROTTLE_MS = 350;

/**
 * One entry in the all-network LWW-Map materialized view: a
 * `buildMergedAllNetworkSnapshot` round plus the active owner at production time
 * (for the per-paint owner guard) and an `origin` discriminator ('cache' floor
 * seed, whose derive-merge hint is read from cached token metadata; vs 'live'
 * raw result, whose derive-merge flag is resolved before building a snapshot).
 */
export type IProgressiveRound = IAllNetworkSnapshotRound & {
  homeRequest?: IHomeTokenRequest;
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
  homeRequest?: IHomeTokenRequest;
  homeTokenRoundRef?: string;
  tokenList: IAccountToken[];
  smallBalanceTokenList: IAccountToken[];
  riskyTokenList: IAccountToken[];
  tokenListMap: Record<string, ITokenFiat>;
  /**
   * Cached per-network worth counting tokens + smallBalanceTokens ONLY (risk
   * excluded — ServiceToken computes it from the two group fiat subtotals).
   * Seeded onto the floor round as its explicit `accountWorth` because the
   * shared full `tokenListMap` below also contains risk-only entries a
   * map-derived sum would wrongly include. Optional: legacy caches predate it.
   */
  tokenListValue?: string;
  aggregateTokenListMap?: { [key: string]: { tokens: IAccountToken[] } };
  aggregateTokenMap?: Record<string, ITokenFiat>;
  accountId: string;
  networkId: string;
}

/** A settled LIVE round (structurally a superset of `IAllNetworkSnapshotRound`). */
export type ILiveRound = IAllNetworkSnapshotRound & {
  homeRequest?: IHomeTokenRequest;
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
  homeRequestRef: MutableRefObject<IHomeTokenRequest | undefined>;
  isHomeRequestCurrent: () => boolean;
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
  buildAuthoritativeSnapshot: () => Promise<
    IMergedAllNetworkSnapshot | undefined
  >;
  /** Ingest the authoritative snapshot + clear timer + bump epoch. */
  commitAuthoritativeIngest: (
    snapshot: IMergedAllNetworkSnapshot,
    homeRequest?: IHomeTokenRequest,
  ) => void;
}

type IIngestOwnerToken = {
  ownerAccountId: string | undefined;
  ownerNetworkId: string | undefined;
  ownerKey: string;
};

function getCacheSeedMergeDeriveAssets(item: ICacheSeedItem): boolean {
  return (
    item.tokenList.some((token) => Boolean(token.mergeAssets)) ||
    item.smallBalanceTokenList.some((token) => Boolean(token.mergeAssets)) ||
    item.riskyTokenList.some((token) => Boolean(token.mergeAssets))
  );
}

export function useTokenListReactivePipeline(
  params: ITokenListReactivePipelineParams,
): ITokenListReactivePipeline {
  const {
    ownerAccountId,
    ownerNetworkId,
    ownerCreateAtNetwork,
    cellsIngestInputsRef,
    homeRequestRef,
    isHomeRequestCurrent,
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
  const progressiveFlushRequestRef = useRef<IHomeTokenRequest | undefined>(
    undefined,
  );
  // P1-e: indirection so `seedAndFlushCache` can drive the shared flush
  // (declared after it) without a hook-ordering / stale-dep cycle.
  const flushProgressiveViewRef = useRef<
    | ((source: string, homeRequest?: IHomeTokenRequest) => Promise<void>)
    | undefined
  >(undefined);
  // H1 epoch guard (P1-g): bumped only by the authoritative commit.
  const progressivePaintEpochRef = useRef(0);
  const publicationRef = useRef(0);
  const snapshotRoundRefs = useRef(
    new WeakMap<IMergedAllNetworkSnapshot, string[]>(),
  );
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

  const isRequestCurrent = useCallback(
    (homeRequest: IHomeTokenRequest | undefined) =>
      homeRequestRef.current === homeRequest &&
      (!homeRequest ||
        homeRequest.ownerKey === cellsIngestInputsRef.current.ownerKey) &&
      isHomeRequestCurrent() &&
      isHomeTokenRequestCurrent(homeRequest),
    [cellsIngestInputsRef, homeRequestRef, isHomeRequestCurrent],
  );

  const resolveRoundsWithMergeFlag = useCallback(
    async (rounds: IProgressiveRound[]): Promise<IProgressiveRound[]> => {
      const liveNetworkIds = Array.from(
        new Set(
          rounds
            .filter(
              (r) => r.origin === 'live' && r.mergeDeriveAssets === undefined,
            )
            .map((r) => r.networkId)
            .filter((id): id is string => Boolean(id)),
        ),
      );
      if (!liveNetworkIds.length) {
        return rounds;
      }
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
        r.mergeDeriveAssets !== undefined || r.origin !== 'live'
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
      snapshot: IMergedAllNetworkSnapshot | (() => IMergedAllNetworkSnapshot),
      source: string,
      homeRequest: IHomeTokenRequest | undefined,
      ownerToken?: IIngestOwnerToken,
      roundRefs?: string[],
    ) => {
      const ownerKey =
        ownerToken?.ownerKey ?? cellsIngestInputsRef.current.ownerKey;
      if (
        !isRequestCurrent(homeRequest) ||
        (homeRequest && homeRequest.ownerKey !== ownerKey)
      ) {
        return;
      }
      publicationRef.current += 1;
      const homePublication = publicationRef.current;
      const inputs = {
        homeRequest,
        homePublication,
        ownerKey,
        storeData: { storeName: EJotaiContextStoreNames.homeTokenList },
        keepDefault: cellsIngestInputsRef.current.nonZeroInputs.keepDefault,
        homeDefaultTokenMap:
          cellsIngestInputsRef.current.nonZeroInputs.homeDefaultTokenMap,
        customTokens: cellsIngestInputsRef.current.nonZeroInputs.customTokens,
        accountId: ownerToken?.ownerAccountId ?? ownerAccountId,
        networkId: ownerToken?.ownerNetworkId ?? ownerNetworkId,
        source,
      };
      const reportError = (error: unknown) => {
        if (!isRequestCanceledError(error)) console.error(error);
      };
      const ingestFullSnapshot = () => {
        if (
          !isRequestCurrent(homeRequest) ||
          publicationRef.current !== homePublication
        )
          return;
        const resolvedSnapshot =
          typeof snapshot === 'function' ? snapshot() : snapshot;
        void backgroundApiProxy.serviceTokenViewModel
          .ingestRound({
            ...inputs,
            orderedTokens: resolvedSnapshot.orderedTokens,
            smallBalanceTokens: resolvedSnapshot.smallBalanceTokens,
            tokenListMap: resolvedSnapshot.mergeTokenListMap,
            aggregateTokensMap: resolvedSnapshot.aggregateTokenMap,
            ownedAggregateTokenListMap: resolvedSnapshot.aggregateTokenListMap,
            smallBalanceFiatValue: resolvedSnapshot.smallBalanceFiatValue,
            riskyTokens: resolvedSnapshot.riskyTokens,
            riskyMap: resolvedSnapshot.riskyTokenListMap,
            rawKeys: `${resolvedSnapshot.tokenKeys}_${resolvedSnapshot.smallBalanceKeys}_${resolvedSnapshot.riskyKeys}`,
          })
          .catch(reportError);
      };
      if (homeRequest && roundRefs?.length) {
        void backgroundApiProxy.serviceTokenViewModel
          .ingestHomeTokenRounds({
            ...inputs,
            homeRequest,
            roundRefs,
            createAtNetwork: ownerCreateAtNetwork,
          })
          .then((applied) => {
            if (!applied) ingestFullSnapshot();
          })
          .catch(reportError);
      } else {
        ingestFullSnapshot();
      }
    },
    [
      cellsIngestInputsRef,
      isRequestCurrent,
      ownerAccountId,
      ownerCreateAtNetwork,
      ownerNetworkId,
    ],
  );

  const flushProgressiveView = useCallback(
    async (source: string, homeRequest?: IHomeTokenRequest) => {
      if (!isRequestCurrent(homeRequest)) return;
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
      if (!isRequestCurrent(homeRequest)) return;
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
      ingestMergedSnapshot(
        () =>
          buildMergedAllNetworkSnapshot({
            rounds: roundsWithFlag,
            mergeDeriveAssetsByNetworkId: {},
            accountId: ownerAccountId,
            createAtNetwork: ownerCreateAtNetwork,
          }),
        source,
        homeRequest,
        ownerTokenAtFlushStart,
        roundsWithFlag.every((round) => !!round.homeTokenRoundRef)
          ? roundsWithFlag.map((round) => round.homeTokenRoundRef as string)
          : undefined,
      );
    },
    [
      ownerAccountId,
      ownerCreateAtNetwork,
      ownerNetworkId,
      cellsIngestInputsRef,
      enabled,
      ingestMergedSnapshot,
      isRequestCurrent,
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
      const homeRequest = homeRequestRef.current;
      if (!isRequestCurrent(homeRequest)) return;
      let accepted = false;
      for (const item of data) {
        if (item.homeRequest === homeRequest) {
          accepted = true;
          progressiveViewRef.current.seedFloor(
            accountUtils.buildAccountValueKey({
              accountId: item.accountId,
              networkId: item.networkId,
            }),
            {
              homeRequest: item.homeRequest,
              homeTokenRoundRef: item.homeTokenRoundRef,
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
              accountWorth: item.tokenListValue,
              aggregateTokenListMap: item.aggregateTokenListMap,
              aggregateTokenMap: item.aggregateTokenMap,
              ownerAccountId,
              ownerNetworkId,
              origin: 'cache',
              mergeDeriveAssets: getCacheSeedMergeDeriveAssets(item),
            },
            generation,
          );
        }
      }
      if (accepted) {
        await flushProgressiveViewRef.current?.('cacheSeed', homeRequest);
      }
    },
    [enabled, homeRequestRef, isRequestCurrent, ownerAccountId, ownerNetworkId],
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
      if (!isRequestCurrent(result.homeRequest)) return;
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
      if (
        progressiveFlushTimerRef.current !== null &&
        progressiveFlushRequestRef.current !== result.homeRequest
      ) {
        // A previous request's timer must not consume the new round's flush.
        clearTimeout(progressiveFlushTimerRef.current);
        progressiveFlushTimerRef.current = null;
      }
      if (progressiveFlushTimerRef.current === null) {
        // P1-e indirection (NOT the captured `flushProgressiveView`): on a rapid
        // owner switch the timer must fire the LATEST flush so its owner guard
        // compares the deferred rounds against the CURRENT owner and skips a
        // stale ingest — even when the consumer's `reset()` is delayed past the
        // throttle window. Capturing the closure would re-run the old owner's
        // flush (old owner == old rounds → guard passes → wasted BG ingest).
        const homeRequest = result.homeRequest;
        progressiveFlushRequestRef.current = homeRequest;
        progressiveFlushTimerRef.current = setTimeout(() => {
          progressiveFlushTimerRef.current = null;
          void flushProgressiveViewRef.current?.('progPaint', homeRequest);
        }, PROGRESSIVE_PAINT_THROTTLE_MS);
      }
    },
    [isRequestCurrent, ownerAccountId, ownerNetworkId],
  );

  const buildAuthoritativeSnapshot = useCallback(async (): Promise<
    IMergedAllNetworkSnapshot | undefined
  > => {
    const homeRequest = homeRequestRef.current;
    if (!isRequestCurrent(homeRequest)) return undefined;
    const ownerGeneration = ownerGenerationRef.current;
    const ownerKey = cellsIngestInputsRef.current.ownerKey;
    const paintEpoch = progressivePaintEpochRef.current;
    const viewRounds = progressiveViewRef.current.materialize(
      enabledKeysRef.current,
    );
    // A new request can retain old rounds as its floor, but must first accept
    // one of its own cache/live rounds before publishing an authoritative view.
    if (
      !viewRounds.length ||
      !viewRounds.some((round) => round.homeRequest === homeRequest)
    ) {
      return undefined;
    }
    const roundsWithFlag = await resolveRoundsWithMergeFlag(viewRounds);
    if (
      !isRequestCurrent(homeRequest) ||
      ownerGenerationRef.current !== ownerGeneration ||
      cellsIngestInputsRef.current.ownerKey !== ownerKey ||
      progressivePaintEpochRef.current !== paintEpoch
    ) {
      return undefined;
    }
    const snapshot = buildMergedAllNetworkSnapshot({
      rounds: roundsWithFlag,
      mergeDeriveAssetsByNetworkId: {},
      accountId: ownerAccountId,
      createAtNetwork: ownerCreateAtNetwork,
    });
    if (viewRounds.every((round) => !!round.homeTokenRoundRef)) {
      snapshotRoundRefs.current.set(
        snapshot,
        viewRounds.map((round) => round.homeTokenRoundRef as string),
      );
    }
    return snapshot;
  }, [
    cellsIngestInputsRef,
    homeRequestRef,
    isRequestCurrent,
    ownerAccountId,
    ownerCreateAtNetwork,
    resolveRoundsWithMergeFlag,
  ]);

  const commitAuthoritativeIngest = useCallback(
    (snapshot: IMergedAllNetworkSnapshot, homeRequest?: IHomeTokenRequest) => {
      if (!isRequestCurrent(homeRequest)) return;
      if (enabled) {
        ingestMergedSnapshot(
          snapshot,
          'authoritative',
          homeRequest,
          undefined,
          snapshotRoundRefs.current.get(snapshot),
        );
      }
      if (progressiveFlushTimerRef.current !== null) {
        clearTimeout(progressiveFlushTimerRef.current);
        progressiveFlushTimerRef.current = null;
      }
      progressivePaintEpochRef.current += 1;
    },
    [enabled, ingestMergedSnapshot, isRequestCurrent],
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
