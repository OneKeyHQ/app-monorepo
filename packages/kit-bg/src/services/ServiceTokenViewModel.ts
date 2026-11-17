/**
 * TokenList cells — Phase-2 BG ServiceTokenViewModel (design §3, §4, §4A).
 *
 * Owns the FRAME PRODUCTION in the BG heap. For each fetch round the home
 * refresh flow hands it the already-settled slices via `ingestRound`; the
 * service builds the two wire frames with the pure `buildFrames` (reused from
 * the relocated cellsPure trio — kit-bg internal, no React/native/jotai), and
 * delegates per-owner version/cache/MRU/pull-blob bookkeeping to the generic
 * `FrameChannelHost` kernel (`@onekeyhq/shared/src/frameChannel`). The service
 * keeps ONLY the domain logic: `buildFrames`, the `riskyChanged` gate, and the
 * per-owner `prev` diff-state — and the `prev`/raw blobs live INSIDE the host's
 * owner slot (as pull-blobs) so they evict atomically with the owner (no
 * separate domain map that could desync from the MRU).
 *
 * Role: this is the "TokenListFrameEngine" — the authoritative bg frame source.
 *
 * SYNCHRONOUS INVARIANT (design §7 risk, MEMORY bg-runtime-nexttick-dead):
 *   - `buildFrames` + the BigNumber summation it relies on are synchronous.
 *   - The whole frame-production path here (ingestRound → buildFrames →
 *     host.pushFrame → appEventBus.emit) MUST stay synchronous: NO await /
 *     nextTick / microtask. BG nextTick is dead on v6.3.0 Android, so any async
 *     hop would silently hang the VM. REVIEW CHECKLIST: do not introduce an
 *     await/microtask anywhere on the ingestRound → emit path.
 */
import {
  backgroundClass,
  backgroundMethod,
} from '@onekeyhq/shared/src/background/backgroundDecorators';
import { AGGREGATE_TOKEN_MOCK_NETWORK_ID } from '@onekeyhq/shared/src/consts/networkConsts';
import type { IAppEventBusPayload } from '@onekeyhq/shared/src/eventBus/appEventBus';
import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
import { FrameChannelHost } from '@onekeyhq/shared/src/frameChannel';
import { buildMergedAllNetworkSnapshot } from '@onekeyhq/shared/src/utils/buildMergedAllNetworkSnapshot';
import type { IAllNetworkSnapshotRound } from '@onekeyhq/shared/src/utils/buildMergedAllNetworkSnapshot';
import networkUtils from '@onekeyhq/shared/src/utils/networkUtils';
import { flattenAggregateTokensMap } from '@onekeyhq/shared/src/utils/tokenUtils';
import type {
  IAccountToken,
  ICustomTokenItem,
  IHomeDefaultToken,
  IHomeTokenRequest,
  IHomeTokenRequestInvalidation,
  IToken,
  ITokenFiat,
} from '@onekeyhq/shared/types/token';

import { settingsPersistAtom } from '../states/jotai/atoms';
import {
  buildFrames,
  metaByKeyFromTokens,
} from '../states/jotai/contexts/tokenList/cellsPure/buildFrames';
import { buildHomeTokenListCacheIngestRound } from '../states/jotai/contexts/tokenList/cellsPure/buildHomeTokenListCacheIngestRound';
import {
  fiatEqual,
  metaEqual,
} from '../states/jotai/contexts/tokenList/cellsPure/pure';
import { homeTokenRequestRegistry } from '../utils/homeTokenRequestRegistry';
import { getVaultSettings } from '../vaults/settings';

import ServiceBase from './ServiceBase';

import type { IJotaiContextStoreData } from '../states/jotai/atoms';
import type {
  IBuildFramesInput,
  IBuildFramesPrev,
} from '../states/jotai/contexts/tokenList/cellsPure/buildFrames';
import type {
  IAggKey,
  INetworkId,
  IStructureSnapshot,
  ITokenKey,
  IValuationFrame,
} from '../states/jotai/contexts/tokenList/cellsPure/types';
import type { IAccountDeriveTypes } from '../vaults/types';

/**
 * The three wire-frame payloads, keyed by FrameChannel kind. Sourced from the
 * appEventBus payload registration so they stay in sync with the bus contract.
 */
type ITokenFramePayloads = {
  structure: IAppEventBusPayload[EAppEventBusNames.TokenListStructureFrame];
  valuation: IAppEventBusPayload[EAppEventBusNames.TokenListValuationFrame];
  risky: IAppEventBusPayload[EAppEventBusNames.TokenListRiskyFrame];
};

/** The per-owner diff `prev` the domain feeds `buildFrames` (a pull-blob). */
interface IDomainPrev {
  slotId: string;
  lastStructure: IBuildFramesPrev['structure'];
  lastScalar: string;
  lastMetaByKey: Record<ITokenKey, IToken | undefined>;
  /** Raw balance by list id as of the last structure frame. */
  lastBalanceByKey: Record<ITokenKey, string | undefined>;
  /** Full normal-token fiat map as of the last valuation frame, for delta calculation. */
  lastFiatByKey: Record<ITokenKey, ITokenFiat | undefined>;
  /** Full aggregate per-network fiat map as of the last valuation frame. */
  lastAggFiatByKey: Record<IAggKey, Record<INetworkId, ITokenFiat> | undefined>;
}

/** The minimal previously-emitted risky shape the change-gate compares against. */
interface IRiskySnapshot {
  riskyTokens: IAccountToken[];
  riskyMap: Record<ITokenKey, ITokenFiat>;
}

/**
 * Raw token-list data for an owner — the merged-with-risky list plus the settled
 * owner identity the switch skeleton needs (design §R0 #3, red-team C-F1: the
 * `allTokenList.accountId/networkId` is the PREVIOUS settled owner, deliberately
 * lagging the scoped current owner; it must survive verbatim so `ownerMismatch`
 * keeps firing). Stored as the owner's `raw` pull-blob (PULL-only, never pushed).
 */
interface IRawTokenListData {
  /** `[...orderedTokens, ...smallBalanceTokens, ...riskyTokens]`. */
  tokens: IAccountToken[];
  /** keys string mirrored from the legacy `allTokenListAtom` write. */
  keys: string;
  /** SETTLED owner accountId (lags the scoped current owner — see above). */
  accountId: string | undefined;
  /** SETTLED owner networkId (lags the scoped current owner — see above). */
  networkId: string | undefined;
  /**
   * Raw `$key -> ITokenFiat` map for this round (normal + small-balance merged).
   * Includes the per-network aggregate SUB-token `$key` fiat — the source the
   * `getAllTokenListMap` composition needs for `checkIsOnlyOneTokenHasBalance`
   * (red-team C-F2: those readers index by the sub-token per-network `$key`,
   * which is NOT in the flattened aggregate map). Kept raw (not the valuation
   * frame's filtered `changedFiatById`) so the composed map is exact.
   */
  tokenListMap: Record<ITokenKey, ITokenFiat>;
  /**
   * Current-round risky `$key -> ITokenFiat` map. Stored on the every-round raw
   * blob (NOT read from the gated risky frame) so the `getAllTokenListMap` PULL
   * composition always sees FRESH risky prices: the risky frame is only pushed
   * on a membership/balance change, so a pure price tick would otherwise leave
   * `getAllTokenListMap` composing STALE risky fiat (regression vs the legacy
   * `allTokenListMapAtom`, which wrote the current round's riskyMap every time).
   */
  riskyMap: Record<ITokenKey, ITokenFiat>;
  /** nested aggregate map `aggKey -> networkId -> ITokenFiat` (for flatten). */
  aggregateTokensMap: Record<IAggKey, Record<INetworkId, ITokenFiat>>;
  /** Last ingest params for this owner so late-arriving nonZero inputs can re-ingest in BG. */
  lastIngestParams?: IIngestRoundParams;
}

/**
 * `ingestRound` params — the already-settled slices of ONE fetch round. These
 * mirror exactly what the home producer reads off the per-store atoms, plus the
 * hideZero authority inputs threaded through to `nonZeroIds`.
 */
export interface IIngestRoundParams {
  homeRequest?: IHomeTokenRequest;
  homePublication?: number;
  ownerKey: string;
  orderedTokens: IAccountToken[];
  smallBalanceTokens: IAccountToken[];
  /** `$key -> ITokenFiat` — normal + small-balance merged (view path). */
  tokenListMap: Record<ITokenKey, ITokenFiat>;
  /** nested aggregate map `aggKey -> networkId -> ITokenFiat`. */
  aggregateTokensMap: Record<IAggKey, Record<INetworkId, ITokenFiat>>;
  /**
   * Per-`$key` OWNED aggregate sub-token METADATA list (`{ tokens }`) — the SAME
   * value the home producer feeds `refreshAggregateTokensListMap`. Carried onto
   * the structure frame so the home cell-path leaves source it from
   * `listStructureAtom` (full-delete PR-7). Optional for older call sites.
   */
  ownedAggregateTokenListMap?: Record<IAggKey, { tokens: IAccountToken[] }>;
  smallBalanceFiatValue: string;
  /** identity-check payload routed through to the frames (see resolveCurrentStore). */
  storeData: IJotaiContextStoreData;
  /** hideZero "keep default zero-balance" inputs (design §3, spec §8#2). */
  keepDefault?: boolean;
  homeDefaultTokenMap?: Record<string, IHomeDefaultToken>;
  customTokens?: ICustomTokenItem[];
  /**
   * Risky token list for this owner (design §R0 #1). NOT part of the home cells
   * structure/valuation frames (those are risk-blind); carried so the VM can
   * build the dedicated risky frame + the merged raw list. Optional for older
   * call sites (defaults to empty).
   */
  riskyTokens?: IAccountToken[];
  /** Risky `$key -> ITokenFiat` map (design §R0 #1). */
  riskyMap?: Record<ITokenKey, ITokenFiat>;
  /**
   * SETTLED owner identity for the `getRawTokenList` switch skeleton (design
   * §R0 #3, red-team C-F1). Mirrors the legacy `allTokenListAtom` fields. These
   * lag the scoped current owner on purpose; the VM stores them verbatim.
   */
  accountId?: string;
  networkId?: string;
  /** keys string mirrored from the legacy `allTokenListAtom` write. */
  rawKeys?: string;
  /**
   * Log-only tag identifying which UI ingest produced this round
   * (single | cacheSeed | progPaint | authoritative).
   */
  source?: string;
}

/**
 * Known frame versions already cached in the UI's per-owner replay cache.
 * When `slotId` matches the BG owner slot's incarnation and a frame's version
 * matches what `main` already holds, `getTokenListFrames` omits the large frame
 * payload and sets the corresponding `*Unchanged` flag to avoid re-serializing
 * 100KB–350KB of identical frame JSON across the bridge.
 */
export interface ITokenListKnownVersions {
  slotId?: string;
  structureVersion?: number;
  structureGeneration?: number;
  valuationVersion?: number;
  riskyVersion?: number;
}

/** Result of a PULL — the authoritative full frames for an owner. */
export interface ITokenListFramesPullResult {
  ownerKey: string;
  slotId?: string;
  structureVersion: number;
  valuationVersion: number;
  structure: IStructureSnapshot | undefined;
  structureUnchanged?: boolean;
  valuation: IValuationFrame | undefined;
  valuationUnchanged?: boolean;
  /** monotonic risky version (-1 when the owner is unknown / has no risky set). */
  riskyVersion: number;
  /** full current risky list (empty when unknown). */
  riskyTokens: IAccountToken[];
  /** full current risky `$key -> ITokenFiat` map (empty when unknown). */
  riskyMap: Record<ITokenKey, ITokenFiat>;
  riskyUnchanged?: boolean;
  /** identity-check payload for the risky frame apply (undefined when unknown). */
  storeData: IJotaiContextStoreData | undefined;
}

/**
 * Result of the `getRawTokenList` PULL (design §R0 #3, PULL-only — never pushed).
 * Returns the merged-with-risky raw list AND the SETTLED owner identity the
 * switch skeleton compares against the scoped current owner.
 */
export interface IRawTokenListPullResult {
  ownerKey: string;
  tokens: IAccountToken[];
  keys: string;
  accountId: string | undefined;
  networkId: string | undefined;
}

/**
 * MRU cap on resident owners. Bounds BG heap growth across owner switches. The
 * cap is also the number of accounts a session can rotate through without the
 * home token list falling back to a skeleton on the switch (OK-63873): an
 * evicted owner has no frames for the UI to PULL until its next fetch round.
 * Wallets with more accounts than the old cap of 8 hit that on every switch.
 * Frames are a few KB per owner, so 32 stays well within budget.
 */
export const OWNER_VM_CAP = 32;
/** pull-blob key for the per-owner diff `prev`. */
const PREV_BLOB_KEY = 'prev';
/** pull-blob key for the per-owner merged raw list. */
const MAX_RETAINED_HOME_ROUNDS = 1024;
const RAW_BLOB_KEY = 'raw';

/** A fresh diff `prev` (generation starts at -1, like the UI producer). */
function freshPrev(slotId: string): IDomainPrev {
  return {
    slotId,
    lastStructure: {
      orderedIds: [],
      smallBalanceIds: [],
      nonZeroIds: [],
      fundedIds: [],
      aggMembership: {},
      ownerKey: '',
      generation: -1,
      ownedAggregateTokenListMap: {},
    },
    lastScalar: '0',
    lastMetaByKey: {},
    lastBalanceByKey: {},
    lastFiatByKey: {},
    lastAggFiatByKey: {},
  };
}

@backgroundClass()
class ServiceTokenViewModel extends ServiceBase {
  constructor({ backgroundApi }: { backgroundApi: any }) {
    super({ backgroundApi });
  }

  private ownerSlotSequence = 0;

  private homeRounds:
    | {
        homeRequest: IHomeTokenRequest;
        entries: Map<
          string,
          { source: string; round: IAllNetworkSnapshotRound }
        >;
      }
    | undefined;

  private readonly homeRoundPrefix = `${Date.now()}-${Math.random().toString(36).slice(2)}`;

  private homeRoundSequence = 0;

  alignHomeTokenRequest(homeRequest: IHomeTokenRequest) {
    homeTokenRequestRegistry.assertCurrent(homeRequest);
    const retained = this.homeRounds;
    if (!retained) return;
    if (
      retained.homeRequest.ownerKey !== homeRequest.ownerKey ||
      retained.homeRequest.mainRuntimeId !== homeRequest.mainRuntimeId
    ) {
      this.homeRounds = undefined;
    } else {
      retained.homeRequest = homeRequest;
    }
  }

  private homePublication:
    | { homeRequest: IHomeTokenRequest; sequence: number }
    | undefined;

  private acceptHomePublication(
    homeRequest?: IHomeTokenRequest,
    sequence?: number,
  ) {
    if (!homeRequest || sequence === undefined) return true;
    const previous = this.homePublication;
    if (
      previous?.homeRequest.mainRuntimeId === homeRequest.mainRuntimeId &&
      previous.homeRequest.generation === homeRequest.generation &&
      previous.sequence > sequence
    )
      return false;
    this.homePublication = { homeRequest, sequence };
    return true;
  }

  // Only the active Home owner needs floors. Entries reference completed BG
  // results; no second token graph is cloned. Two versions per source cover
  // the interval between a new BG result and its arrival in main.
  retainHomeTokenRound({
    homeRequest,
    round,
    origin,
  }: {
    homeRequest: IHomeTokenRequest;
    round: IAllNetworkSnapshotRound;
    origin: 'cache' | 'live';
  }): string {
    homeTokenRequestRegistry.assertCurrent(homeRequest);
    if (
      this.homeRounds?.homeRequest.ownerKey !== homeRequest.ownerKey ||
      this.homeRounds.homeRequest.mainRuntimeId !== homeRequest.mainRuntimeId
    ) {
      this.homeRounds = { homeRequest, entries: new Map() };
    }
    this.homeRounds.homeRequest = homeRequest;
    const entries = this.homeRounds.entries;
    const source = JSON.stringify([round.accountId, round.networkId, origin]);
    const previous = Array.from(entries).filter(
      ([, entry]) => entry.source === source,
    );
    if (previous.length >= 2) entries.delete(previous[0][0]);
    this.homeRoundSequence += 1;
    const ref = `${this.homeRoundPrefix}:${this.homeRoundSequence}`;
    entries.set(ref, { source, round });
    if (entries.size > MAX_RETAINED_HOME_ROUNDS) {
      const oldest = entries.keys().next().value;
      if (oldest) entries.delete(oldest);
    }
    return ref;
  }

  retireHomeTokenRounds(request: IHomeTokenRequestInvalidation) {
    const current = this.homeRounds?.homeRequest;
    if (
      current?.mainRuntimeId === request.mainRuntimeId &&
      request.generation >= current.generation
    ) {
      this.homeRounds = undefined;
    }
  }

  @backgroundMethod()
  async ingestHomeTokenRounds({
    homeRequest,
    roundRefs,
    createAtNetwork,
    persistAggregateMaps,
    ...inputs
  }: Pick<
    IIngestRoundParams,
    | 'ownerKey'
    | 'accountId'
    | 'networkId'
    | 'storeData'
    | 'keepDefault'
    | 'homeDefaultTokenMap'
    | 'customTokens'
    | 'source'
    | 'homePublication'
  > & {
    homeRequest: IHomeTokenRequest;
    roundRefs: string[];
    createAtNetwork?: string;
    persistAggregateMaps?: boolean;
  }): Promise<boolean> {
    homeTokenRequestRegistry.assertCurrent(homeRequest, inputs.ownerKey);
    if (!this.acceptHomePublication(homeRequest, inputs.homePublication))
      return true;
    const retained = this.homeRounds;
    if (
      !retained ||
      retained.homeRequest.ownerKey !== inputs.ownerKey ||
      retained.homeRequest.mainRuntimeId !== homeRequest.mainRuntimeId
    )
      return false;
    const rounds: IAllNetworkSnapshotRound[] = [];
    for (const ref of roundRefs) {
      const entry = retained.entries.get(ref);
      if (!entry) return false;
      rounds.push(entry.round);
    }
    if (!rounds.length) return false;
    const snapshot = buildMergedAllNetworkSnapshot({
      rounds,
      mergeDeriveAssetsByNetworkId: {},
      accountId: inputs.accountId,
      createAtNetwork,
    });
    const prevRaw = this.frames.getPullBlob<IRawTokenListData>(
      inputs.ownerKey,
      RAW_BLOB_KEY,
    );
    const resolvedInputs = {
      ...inputs,
      homeDefaultTokenMap:
        inputs.homeDefaultTokenMap ??
        prevRaw?.lastIngestParams?.homeDefaultTokenMap,
      customTokens:
        inputs.customTokens ?? prevRaw?.lastIngestParams?.customTokens,
    };
    // Call synchronously so frame production retains the existing no-yield
    // contract. Only the RPC acknowledgement resolves asynchronously.
    return this.ingestRound({
      ...resolvedInputs,
      homeRequest,
      orderedTokens: snapshot.orderedTokens,
      smallBalanceTokens: snapshot.smallBalanceTokens,
      tokenListMap: snapshot.mergeTokenListMap,
      aggregateTokensMap: snapshot.aggregateTokenMap,
      ownedAggregateTokenListMap: snapshot.aggregateTokenListMap,
      smallBalanceFiatValue: snapshot.smallBalanceFiatValue,
      riskyTokens: snapshot.riskyTokens,
      riskyMap: snapshot.riskyTokenListMap,
      rawKeys: `${snapshot.tokenKeys}_${snapshot.smallBalanceKeys}_${snapshot.riskyKeys}`,
    }).then(() => {
      if (
        persistAggregateMaps &&
        inputs.networkId &&
        inputs.accountId &&
        this.backgroundApi?.serviceToken
      ) {
        if ('updateLocalAggregateTokenMap' in this.backgroundApi.serviceToken) {
          void this.backgroundApi.serviceToken.updateLocalAggregateTokenMap({
            networkId: inputs.networkId,
            accountId: inputs.accountId,
            aggregateTokenMap: snapshot.aggregateTokenMap,
          });
        }
        if (
          'updateLocalAggregateTokenListMap' in this.backgroundApi.serviceToken
        ) {
          void this.backgroundApi.serviceToken.updateLocalAggregateTokenListMap(
            {
              networkId: inputs.networkId,
              accountId: inputs.accountId,
              aggregateTokenListMap: snapshot.aggregateTokenListMap,
            },
          );
        }
      }
      return true;
    });
  }

  /**
   * The generic frame-channel kernel. Owns per-(owner, kind) versions, the
   * last-payload cache (PULL backstop), the per-owner pull-blobs (`prev` + raw),
   * and the MRU eviction. `emit` is wired to the real bus here; the loose cast is
   * the single boundary cast (the kernel stays generic + appEventBus-agnostic).
   */
  private readonly frames = new FrameChannelHost<ITokenFramePayloads>({
    ownerCap: OWNER_VM_CAP,
    kinds: {
      structure: {
        eventName: EAppEventBusNames.TokenListStructureFrame,
        versionMode: 'domain',
      },
      valuation: {
        eventName: EAppEventBusNames.TokenListValuationFrame,
        versionMode: 'increment',
      },
      risky: {
        eventName: EAppEventBusNames.TokenListRiskyFrame,
        versionMode: 'increment',
      },
    },
    emit: (eventName, payload) => {
      (appEventBus.emit as (t: string, p: unknown) => boolean)(
        eventName,
        payload,
      );
    },
  });

  /**
   * Ingest ONE fetch round for an owner: build the two frames via the pure
   * `buildFrames`, push them through the host (structure first, then valuation,
   * then the gated risky), and store the diff `prev` + raw list as pull-blobs.
   *
   * SYNCHRONOUS body: no await/nextTick/microtask anywhere (the `async`/`Promise`
   * is only the @backgroundMethod RPC contract; the body runs synchronously
   * before any microtask; the UI calls it fire-and-forget).
   */
  @backgroundMethod()
  async ingestRound(params: IIngestRoundParams): Promise<void> {
    homeTokenRequestRegistry.assertCurrent(params.homeRequest, params.ownerKey);
    if (!this.acceptHomePublication(params.homeRequest, params.homePublication))
      return;
    const {
      ownerKey,
      orderedTokens,
      smallBalanceTokens,
      tokenListMap,
      aggregateTokensMap,
      ownedAggregateTokenListMap,
      smallBalanceFiatValue,
      storeData,
      keepDefault,
      homeDefaultTokenMap,
      customTokens,
      riskyTokens = [],
      riskyMap = {},
      accountId,
      networkId,
      rawKeys = '',
      source,
    } = params;

    if (!ownerKey) {
      return;
    }

    // A cache seed or a progressive paint is not the round's final answer
    // (OK-63873): the UI paints it but must not persist it as the owner's
    // last-known list. Everything else (the single-network live round, the
    // authoritative all-networks round, older call sites) is settled.
    const provisional =
      source === 'cacheSeed' ||
      source === 'progPaint' ||
      source === 'singleCacheSeed' ||
      source === 'singleEmptyCacheSeed';

    // Mark MRU + ensure the owner slot exists. `ingestRound` REPLACES (not
    // concats) the owner's slices each round: `buildFrames` takes the full
    // current input and the `prev` blob compares full-vs-full, so a coherent
    // merged snapshot fed by the UI yields a structure frame that reflects the
    // whole current list, not one incremental round.
    this.frames.touchOwner(ownerKey);

    const existingPrevBlob = this.frames.getPullBlob<IDomainPrev>(
      ownerKey,
      PREV_BLOB_KEY,
    );
    if (!existingPrevBlob) {
      this.ownerSlotSequence += 1;
    }
    const slotId =
      existingPrevBlob?.slotId ??
      `${this.homeRoundPrefix}-slot-${this.ownerSlotSequence}`;
    const prevBlob = existingPrevBlob ?? freshPrev(slotId);
    if (!existingPrevBlob) {
      this.frames.setPullBlob(ownerKey, PREV_BLOB_KEY, prevBlob);
    }

    const input: IBuildFramesInput = {
      orderedTokens,
      smallBalanceTokens,
      tokenListMap,
      aggregateTokensMap,
      ownedAggregateTokenListMap,
      smallBalanceFiatValue,
      ownerKey,
      storeData,
      keepDefault,
      homeDefaultTokenMap,
      customTokens,
    };

    const prev: IBuildFramesPrev = {
      structure: prevBlob.lastStructure,
      smallBalanceFiatValue: prevBlob.lastScalar,
      metaByKey: prevBlob.lastMetaByKey,
      // A blob persisted before this field existed reads as "no balances
      // known": the next round then emits one structure frame and seeds it.
      balanceByKey: prevBlob.lastBalanceByKey ?? {},
    };

    const { structure, valuation, balanceByKey } = buildFrames(input, prev);
    homeTokenRequestRegistry.assertCurrent(params.homeRequest, params.ownerKey);
    if (structure) {
      structure.provisional = provisional;
      structure.settledAccountId = accountId;
      structure.settledNetworkId = networkId;
      structure.rawKeys = rawKeys;
      structure.riskyCount = riskyTokens.length;
    }
    valuation.provisional = provisional;
    valuation.structureGeneration =
      structure?.generation ?? prevBlob.lastStructure.generation;

    // Structure FIRST (preserve the legacy emit order), then valuation.
    let nextStructurePrev = prevBlob.lastStructure;
    let nextScalarPrev = prevBlob.lastScalar;
    let nextMetaByKeyPrev = prevBlob.lastMetaByKey;
    let nextBalanceByKeyPrev = prevBlob.lastBalanceByKey ?? {};

    if (structure) {
      const deltaMetaPatch: Record<ITokenKey, IToken> = {};
      for (const key of Object.keys(structure.metaPatch)) {
        const nextMeta = structure.metaPatch[key];
        if (!metaEqual(prevBlob.lastMetaByKey[key], nextMeta)) {
          deltaMetaPatch[key] = nextMeta;
        }
      }

      // Structural change — push the frame (version == the structure's own
      // generation, domain-supplied). On subsequent frames (prevVersion >= 0),
      // emit only the changed/added `metaPatch` entries with `baseVersion` so
      // `main` applies an O(delta) patch while the BG host slot retains the
      // full snapshot for PULL backstops.
      this.frames.pushFrame(
        'structure',
        ownerKey,
        (version, prevVersion) =>
          prevVersion >= 0
            ? {
                ownerKey,
                slotId,
                baseVersion: prevVersion,
                isDelta: true,
                structureVersion: version,
                structure: {
                  ...structure,
                  metaPatch: deltaMetaPatch,
                },
              }
            : {
                ownerKey,
                slotId,
                structureVersion: version,
                structure,
              },
        {
          version: structure.generation,
          storedPayload: (version) => ({
            ownerKey,
            slotId,
            structureVersion: version,
            structure,
          }),
        },
      );
      nextStructurePrev = {
        orderedIds: structure.orderedIds,
        smallBalanceIds: structure.smallBalanceIds,
        nonZeroIds: structure.nonZeroIds,
        fundedIds: structure.fundedIds,
        aggMembership: structure.aggMembership,
        ownerKey: structure.ownerKey,
        generation: structure.generation,
        ownedAggregateTokenListMap: structure.ownedAggregateTokenListMap,
      };
      nextScalarPrev = structure.smallBalanceFiatValue;
      nextMetaByKeyPrev = metaByKeyFromTokens([
        ...orderedTokens,
        ...smallBalanceTokens,
      ]);
      nextBalanceByKeyPrev = balanceByKey;
    }

    const prevFiatByKey = prevBlob.lastFiatByKey ?? {};
    const prevAggFiatByKey = prevBlob.lastAggFiatByKey ?? {};
    const deltaChangedFiatById: Record<ITokenKey, ITokenFiat> = {};
    for (const key of Object.keys(valuation.changedFiatById)) {
      const nextFiat = valuation.changedFiatById[key];
      const isNewlyAddedKey = !(key in prevBlob.lastMetaByKey);
      if (isNewlyAddedKey || !fiatEqual(prevFiatByKey[key], nextFiat)) {
        deltaChangedFiatById[key] = nextFiat;
      }
    }
    const removedFiatIds: ITokenKey[] = [];
    for (const key of Object.keys(prevFiatByKey)) {
      if (!(key in valuation.changedFiatById)) {
        removedFiatIds.push(key);
      }
    }
    const deltaChangedAggFiat: Record<
      IAggKey,
      Record<INetworkId, ITokenFiat>
    > = {};
    for (const aggKey of Object.keys(valuation.changedAggFiat)) {
      const nextByNet = valuation.changedAggFiat[aggKey];
      const prevByNet = prevAggFiatByKey[aggKey];
      let changedNetEntries: Record<INetworkId, ITokenFiat> | undefined;
      for (const netId of Object.keys(nextByNet)) {
        const nextFiat = nextByNet[netId];
        if (!prevByNet || !fiatEqual(prevByNet[netId], nextFiat)) {
          changedNetEntries ??= {};
          changedNetEntries[netId] = nextFiat;
        }
      }
      if (changedNetEntries) {
        deltaChangedAggFiat[aggKey] = changedNetEntries;
      }
    }
    const removedAggFiat: Record<IAggKey, INetworkId[]> = {};
    for (const aggKey of Object.keys(prevAggFiatByKey)) {
      const prevByNet = prevAggFiatByKey[aggKey];
      const nextByNet = valuation.changedAggFiat[aggKey];
      if (prevByNet && nextByNet) {
        const missingNets = Object.keys(prevByNet).filter(
          (netId) => !(netId in nextByNet) || !nextByNet[netId],
        );
        if (missingNets.length > 0) {
          removedAggFiat[aggKey] = missingNets;
        }
      }
    }

    // Valuation is emitted on EVERY round: first round (prevVersion < 0) emits
    // the full baseline; subsequent rounds (prevVersion >= 0) emit only the
    // changed/newly-added fiat entries with `baseVersion`, while `storedPayload`
    // keeps the full map in the BG slot for `getTokenListFrames` PULLs.
    this.frames.pushFrame(
      'valuation',
      ownerKey,
      (version, prevVersion) =>
        prevVersion >= 0
          ? {
              ownerKey,
              slotId,
              baseVersion: prevVersion,
              isDelta: true,
              valuationVersion: version,
              valuation: {
                ...valuation,
                changedFiatById: deltaChangedFiatById,
                changedAggFiat: deltaChangedAggFiat,
                ...(removedFiatIds.length > 0 ? { removedFiatIds } : undefined),
                ...(Object.keys(removedAggFiat).length > 0
                  ? { removedAggFiat }
                  : undefined),
              },
            }
          : {
              ownerKey,
              slotId,
              valuationVersion: version,
              valuation,
            },
      {
        storedPayload: (version) => ({
          ownerKey,
          slotId,
          valuationVersion: version,
          valuation,
        }),
      },
    );

    this.frames.setPullBlob(ownerKey, PREV_BLOB_KEY, {
      slotId,
      lastStructure: nextStructurePrev,
      lastScalar: nextScalarPrev,
      lastMetaByKey: nextMetaByKeyPrev,
      lastBalanceByKey: nextBalanceByKeyPrev,
      lastFiatByKey: valuation.changedFiatById,
      lastAggFiatByKey: valuation.changedAggFiat,
    } satisfies IDomainPrev);

    const framesNow = this.frames.getFrames(ownerKey);

    // --- raw token list (PULL-only source) ---------------------------------
    // REPLACE (not concat) the owner's raw slices each round: the merged list is
    // [...orderedTokens, ...smallBalanceTokens, ...riskyTokens] (mirrors the
    // legacy `allTokenListAtom` write), kept for the `getRawTokenList` PULL
    // together with the SETTLED owner identity (red-team C-F1). Never pushed.
    this.frames.setPullBlob(ownerKey, RAW_BLOB_KEY, {
      tokens: [...orderedTokens, ...smallBalanceTokens, ...riskyTokens],
      keys: rawKeys,
      accountId,
      networkId,
      tokenListMap,
      riskyMap,
      aggregateTokensMap,
      lastIngestParams: params,
    } satisfies IRawTokenListData);

    // --- risky frame (design §R0 #2) ---------------------------------------
    // SYNCHRONOUS change-gate over the PREVIOUSLY-pushed risky payload (read back
    // from the host cache): emit a FULL idempotent risky snapshot only when the
    // risky set changes by membership ($key set) OR by a per-`$key` BALANCE
    // change (red-team C-F4). A pure price tick does NOT emit.
    const prevRisky = framesNow.risky.payload;
    if (this.riskyChanged(prevRisky, riskyTokens, riskyMap)) {
      this.frames.pushFrame('risky', ownerKey, (version) => ({
        ownerKey,
        slotId,
        riskyVersion: version,
        riskyTokens,
        riskyMap,
        storeData,
      }));
    }
  }

  /**
   * Re-runs `ingestRound` for an already-settled owner when asynchronous
   * hideZero inputs (`homeDefaultTokenMap` or `customTokens`) resolve or change
   * after the initial single-network ingest.
   */
  @backgroundMethod()
  async refreshOwnerNonZeroInputs({
    homeRequest,
    ownerKey,
    keepDefault,
    homeDefaultTokenMap,
    customTokens,
  }: {
    homeRequest?: IHomeTokenRequest;
    ownerKey: string;
    keepDefault?: boolean;
    homeDefaultTokenMap?: Record<string, IHomeDefaultToken>;
    customTokens?: ICustomTokenItem[];
  }): Promise<void> {
    homeTokenRequestRegistry.assertCurrent(homeRequest, ownerKey);
    const raw = this.frames.getPullBlob<IRawTokenListData>(
      ownerKey,
      RAW_BLOB_KEY,
    );
    if (!raw?.lastIngestParams) {
      return;
    }
    await this.ingestRound({
      ...raw.lastIngestParams,
      homeRequest: homeRequest ?? raw.lastIngestParams.homeRequest,
      keepDefault: keepDefault ?? raw.lastIngestParams.keepDefault,
      homeDefaultTokenMap:
        homeDefaultTokenMap ?? raw.lastIngestParams.homeDefaultTokenMap,
      customTokens: customTokens ?? raw.lastIngestParams.customTokens,
    });
  }

  /**
   * SYNCHRONOUS risky change-gate (design §R0 #2, red-team C-F4 / R-#1). Returns
   * true when the risky set differs from the previously-emitted snapshot by
   * either its `$key` membership OR any per-`$key` balance. A pure price-only
   * move (same $keys + same balances) returns false so no risky frame is emitted.
   */
  private riskyChanged(
    prev: IRiskySnapshot | undefined,
    nextTokens: IAccountToken[],
    nextMap: Record<ITokenKey, ITokenFiat>,
  ): boolean {
    if (!prev) {
      // First risky observation for the owner. Emit only when there is actually
      // a risky set so an owner with no risky tokens stays at riskyVersion -1.
      return nextTokens.length > 0;
    }
    const prevTokens = prev.riskyTokens;
    if (prevTokens.length !== nextTokens.length) {
      return true;
    }
    // Membership ($key order included — the list is sorted deterministically by
    // the producer) AND per-`$key` balance comparison in one pass.
    for (let i = 0; i < nextTokens.length; i += 1) {
      const key = nextTokens[i].$key;
      if (prevTokens[i].$key !== key) {
        return true;
      }
      const prevBalance = prev.riskyMap[key]?.balance;
      const nextBalance = nextMap[key]?.balance;
      if (prevBalance !== nextBalance) {
        return true;
      }
    }
    return false;
  }

  /**
   * PULL backstop (design §4). Returns the current full structure snapshot +
   * full valuation frame for the owner, with their monotonic versions. Returns
   * an empty (undefined frames, -1 versions) result when the owner is unknown so
   * the UI shell can no-op the apply.
   */
  @backgroundMethod()
  async getTokenListFrames({
    ownerKey,
    knownVersions,
  }: {
    ownerKey: string;
    knownVersions?: ITokenListKnownVersions;
  }): Promise<ITokenListFramesPullResult> {
    const frames = this.frames.getFrames(ownerKey);
    const prevBlob = this.frames.getPullBlob<IDomainPrev>(
      ownerKey,
      PREV_BLOB_KEY,
    );
    const slotId = prevBlob?.slotId;
    const structureP = frames.structure.payload;
    const valuationP = frames.valuation.payload;
    const riskyP = frames.risky.payload;
    const sameSlot = Boolean(
      slotId && knownVersions?.slotId && knownVersions.slotId === slotId,
    );
    const structureUnchanged = Boolean(
      sameSlot &&
      frames.structure.version >= 0 &&
      structureP?.structure &&
      knownVersions?.structureVersion === frames.structure.version &&
      knownVersions?.structureGeneration === structureP.structure.generation,
    );
    const valuationUnchanged = Boolean(
      sameSlot &&
      frames.valuation.version >= 0 &&
      valuationP?.valuation &&
      knownVersions?.valuationVersion === frames.valuation.version,
    );
    const riskyUnchanged = Boolean(
      sameSlot &&
      frames.risky.version >= 0 &&
      riskyP &&
      knownVersions?.riskyVersion === frames.risky.version,
    );
    return {
      ownerKey,
      ...(slotId ? { slotId } : undefined),
      structureVersion: frames.structure.version,
      valuationVersion: frames.valuation.version,
      structure: structureUnchanged ? undefined : structureP?.structure,
      ...(structureUnchanged ? { structureUnchanged: true } : undefined),
      valuation: valuationUnchanged ? undefined : valuationP?.valuation,
      ...(valuationUnchanged ? { valuationUnchanged: true } : undefined),
      riskyVersion: frames.risky.version,
      riskyTokens: riskyUnchanged ? [] : (riskyP?.riskyTokens ?? []),
      riskyMap: riskyUnchanged ? {} : (riskyP?.riskyMap ?? {}),
      ...(riskyUnchanged ? { riskyUnchanged: true } : undefined),
      // The risky frame apply needs the owner's storeData for the identity check;
      // the structure/valuation snapshots already carry it, so reuse whichever is
      // present (both are stamped for the same owner).
      storeData:
        riskyP?.storeData ??
        structureP?.structure.storeData ??
        valuationP?.valuation.storeData,
    };
  }

  /**
   * Prewarm an owner's frames from the local token cache before the account
   * selector publishes it (OK-63873). The home page paints a switch from the
   * main-heap replay cache; an owner nobody visited this session (or after a
   * cold start with the persisted slot gone) had nothing there, so the list
   * showed a skeleton for the ~100 ms the local-cache seed round took after
   * the publish. The seed is the same round `TokenListBlock` ingests after the
   * switch (`buildHomeTokenListCacheIngestRound`, provisional), built here
   * from the same local cache so the UI can remember it ahead of the tap.
   * Resident owners return their current frames without re-ingesting.
   * Skipped for All Networks and merge-derive owners, whose seed is a merge
   * the UI owns; they keep the post-publish path.
   */
  @backgroundMethod()
  async prewarmHomeTokenListFrames({
    networkId,
    deriveType,
    indexedAccountId,
    othersWalletAccountId,
  }: {
    networkId: string | undefined;
    deriveType: IAccountDeriveTypes | undefined;
    indexedAccountId?: string;
    othersWalletAccountId?: string;
  }): Promise<
    | {
        ownerKey: string;
        frames: ITokenListFramesPullResult;
        currency: string;
        /**
         * The local cache's per-network worth for the header, present only
         * when the cache was read here (a resident owner keeps the worth the
         * UI remembered on its visit). Tagged with the cache's fiat basis.
         */
        worth?: { accountId: string; value: string; currency: string };
      }
    | undefined
  > {
    if (!networkId || networkUtils.isAllNetwork({ networkId })) {
      return undefined;
    }
    const { serviceAccount, serviceToken, serviceCustomToken, serviceNetwork } =
      this.backgroundApi;
    let accountId = othersWalletAccountId;
    if (!accountId) {
      if (!indexedAccountId || !deriveType) {
        return undefined;
      }
      try {
        const [vaultSettings, deriveInfoItems] = await Promise.all([
          getVaultSettings({ networkId }),
          serviceNetwork.getDeriveInfoItemsOfNetwork({ networkId }),
        ]);
        if (
          vaultSettings.mergeDeriveAssetsEnabled &&
          deriveInfoItems.length > 1
        ) {
          return undefined;
        }
        const networkAccount = await serviceAccount.getNetworkAccount({
          accountId: undefined,
          indexedAccountId,
          deriveType,
          networkId,
        });
        accountId = networkAccount?.id;
      } catch {
        return undefined;
      }
    }
    if (!accountId) {
      return undefined;
    }
    const ownerKey = `${accountId}__${networkId}`;
    const currency = (await settingsPersistAtom.get())?.currencyInfo?.id ?? '';
    let worth:
      | { accountId: string; value: string; currency: string }
      | undefined;
    const isOwnerResident = () =>
      this.frames.getFrames(ownerKey).structure.version >= 0;
    if (!isOwnerResident()) {
      const localTokens = await serviceToken.getAccountLocalTokens({
        accountId,
        networkId,
      });
      // The owner's own rounds can land while the cache is read (the home page
      // fetching the owner it was just switched to, or still seeding it after
      // a cold start). Their frames are what the switch should paint, whether
      // or not the local cache had anything: return them, as for a resident
      // owner, instead of reporting an empty cache.
      if (isOwnerResident()) {
        const frames = await this.getTokenListFrames({ ownerKey });
        return frames.structure ? { ownerKey, frames, currency } : undefined;
      }
      if (
        !localTokens.hasCache ||
        (localTokens.tokenList.length === 0 &&
          localTokens.smallBalanceTokenList.length === 0 &&
          localTokens.riskyTokenList.length === 0)
      ) {
        return undefined;
      }
      if (localTokens.tokenListValue && localTokens.currency) {
        worth = {
          accountId,
          value: localTokens.tokenListValue,
          currency: localTokens.currency,
        };
      }
      const [homeDefaultTokenMap, customTokens] = await Promise.all([
        serviceToken.getHomeDefaultTokenMap(),
        serviceCustomToken.getCustomTokensBatch({
          pairs: [
            { accountId, networkId },
            {
              accountId: indexedAccountId ?? accountId,
              accountXpubOrAddress: indexedAccountId ?? accountId,
              networkId: AGGREGATE_TOKEN_MOCK_NETWORK_ID,
            },
          ],
        }),
      ]);
      // Same re-check after the reads above: this provisional seed must not
      // replace a round that landed meanwhile.
      if (isOwnerResident()) {
        const frames = await this.getTokenListFrames({ ownerKey });
        return frames.structure ? { ownerKey, frames, currency } : undefined;
      }
      const pick = (tokens: IAccountToken[]) => {
        const map: Record<string, ITokenFiat> = {};
        tokens.forEach((token) => {
          const fiat = localTokens.tokenListMap[token.$key];
          if (fiat) {
            map[token.$key] = fiat;
          }
        });
        return map;
      };
      await this.ingestRound(
        buildHomeTokenListCacheIngestRound({
          ownerKey,
          accountId,
          networkId,
          tokenList: localTokens.tokenList,
          smallBalanceTokenList: localTokens.smallBalanceTokenList,
          riskyTokenList: localTokens.riskyTokenList,
          tokenListMap: pick(localTokens.tokenList),
          smallBalanceTokenListMap: pick(localTokens.smallBalanceTokenList),
          riskyTokenListMap: pick(localTokens.riskyTokenList),
          // Home keeps default zero-balance tokens (TokenListView defaults
          // keepDefaultZeroBalanceTokens=true on the home path).
          keepDefault: true,
          homeDefaultTokenMap,
          customTokens,
          source: 'singleCacheSeed',
        }),
      );
    }
    const frames = await this.getTokenListFrames({ ownerKey });
    if (!frames.structure) {
      return undefined;
    }
    return { ownerKey, frames, currency, worth };
  }

  /**
   * PULL-only raw token list (design §R0 #3, "推小拉大"). Returns the owner's
   * merged-with-risky raw list AND the SETTLED owner identity. Returns an empty
   * list + undefined identity for an unknown / evicted owner.
   */
  @backgroundMethod()
  async getRawTokenList({
    ownerKey,
  }: {
    ownerKey: string;
  }): Promise<IRawTokenListPullResult> {
    const raw = this.frames.getPullBlob<IRawTokenListData>(
      ownerKey,
      RAW_BLOB_KEY,
    );
    if (!raw) {
      return {
        ownerKey,
        tokens: [],
        keys: '',
        accountId: undefined,
        networkId: undefined,
      };
    }
    return {
      ownerKey,
      tokens: raw.tokens,
      keys: raw.keys,
      accountId: raw.accountId,
      networkId: raw.networkId,
    };
  }

  /**
   * PULL the FULL fiat map for an owner (design §R0 #4). Composed SYNCHRONOUSLY
   * as `{ ...tokenListMap, ...riskyMap, ...flatten(aggregateTokensMap) }` —
   * mirroring the legacy `allTokenListMapAtom` write. Returns an empty map for an
   * unknown / evicted owner.
   */
  @backgroundMethod()
  async getAllTokenListMap({
    ownerKey,
  }: {
    ownerKey: string;
  }): Promise<Record<ITokenKey, ITokenFiat>> {
    const raw = this.frames.getPullBlob<IRawTokenListData>(
      ownerKey,
      RAW_BLOB_KEY,
    );
    if (!raw) {
      return {};
    }
    // Compose from the every-round raw blob's own `riskyMap` (NOT the gated risky
    // frame payload): the risky frame is suppressed on a pure price tick, so
    // reading it here would compose STALE risky fiat. The raw blob is rewritten
    // every round, so `raw.riskyMap` always carries the current round's prices.
    return {
      ...raw.tokenListMap,
      ...raw.riskyMap,
      ...flattenAggregateTokensMap(raw.aggregateTokensMap),
    };
  }
}

export default ServiceTokenViewModel;
