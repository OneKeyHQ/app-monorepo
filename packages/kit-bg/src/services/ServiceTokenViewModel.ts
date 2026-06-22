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
import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
import type { IAppEventBusPayload } from '@onekeyhq/shared/src/eventBus/appEventBus';
import { FrameChannelHost } from '@onekeyhq/shared/src/frameChannel';
import { flattenAggregateTokensMap } from '@onekeyhq/shared/src/utils/tokenUtils';
import type {
  IAccountToken,
  ICustomTokenItem,
  IHomeDefaultToken,
  IToken,
  ITokenFiat,
} from '@onekeyhq/shared/types/token';

import {
  buildFrames,
  metaByKeyFromTokens,
} from '../states/jotai/contexts/tokenList/cellsPure/buildFrames';

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
  lastStructure: IBuildFramesPrev['structure'];
  lastScalar: string;
  lastMetaByKey: Record<ITokenKey, IToken | undefined>;
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
}

/**
 * `ingestRound` params — the already-settled slices of ONE fetch round. These
 * mirror exactly what the home producer reads off the per-store atoms, plus the
 * hideZero authority inputs threaded through to `nonZeroIds`.
 */
export interface IIngestRoundParams {
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

/** Result of a PULL — the authoritative full frames for an owner. */
export interface ITokenListFramesPullResult {
  ownerKey: string;
  structureVersion: number;
  valuationVersion: number;
  structure: IStructureSnapshot | undefined;
  valuation: IValuationFrame | undefined;
  /** monotonic risky version (-1 when the owner is unknown / has no risky set). */
  riskyVersion: number;
  /** full current risky list (empty when unknown). */
  riskyTokens: IAccountToken[];
  /** full current risky `$key -> ITokenFiat` map (empty when unknown). */
  riskyMap: Record<ITokenKey, ITokenFiat>;
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
 * MRU cap on resident owners. Bounds BG heap growth across owner switches; 8 is
 * comfortably above the count of stores a single session paints concurrently
 * (home + urlAccount + a transient switch target).
 */
const OWNER_VM_CAP = 8;
/** pull-blob key for the per-owner diff `prev`. */
const PREV_BLOB_KEY = 'prev';
/** pull-blob key for the per-owner merged raw list. */
const RAW_BLOB_KEY = 'raw';

/** A fresh diff `prev` (generation starts at -1, like the UI producer). */
function freshPrev(): IDomainPrev {
  return {
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
  };
}

@backgroundClass()
class ServiceTokenViewModel extends ServiceBase {
  constructor({ backgroundApi }: { backgroundApi: any }) {
    super({ backgroundApi });
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
    } = params;

    if (!ownerKey) {
      return;
    }

    // Mark MRU + ensure the owner slot exists. `ingestRound` REPLACES (not
    // concats) the owner's slices each round: `buildFrames` takes the full
    // current input and the `prev` blob compares full-vs-full, so a coherent
    // merged snapshot fed by the UI yields a structure frame that reflects the
    // whole current list, not one incremental round.
    this.frames.touchOwner(ownerKey);

    const prevBlob =
      this.frames.getPullBlob<IDomainPrev>(ownerKey, PREV_BLOB_KEY) ??
      freshPrev();

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
    };

    const { structure, valuation } = buildFrames(input, prev);

    // Structure FIRST (preserve the legacy emit order), then valuation.
    if (structure) {
      // Structural change — push the frame (version == the structure's own
      // generation, domain-supplied) and advance the diff `prev` blob so the
      // next round compares against what we just emitted.
      this.frames.pushFrame(
        'structure',
        ownerKey,
        (version) => ({ ownerKey, structureVersion: version, structure }),
        { version: structure.generation },
      );
      this.frames.setPullBlob(ownerKey, PREV_BLOB_KEY, {
        lastStructure: {
          orderedIds: structure.orderedIds,
          smallBalanceIds: structure.smallBalanceIds,
          nonZeroIds: structure.nonZeroIds,
          fundedIds: structure.fundedIds,
          aggMembership: structure.aggMembership,
          ownerKey: structure.ownerKey,
          generation: structure.generation,
          ownedAggregateTokenListMap: structure.ownedAggregateTokenListMap,
        },
        lastScalar: structure.smallBalanceFiatValue,
        lastMetaByKey: metaByKeyFromTokens([
          ...orderedTokens,
          ...smallBalanceTokens,
        ]),
      } satisfies IDomainPrev);
    }

    // Valuation is emitted on EVERY round (the full current fiat map is
    // idempotent + self-healing); the increment kind bumps its version each time.
    this.frames.pushFrame('valuation', ownerKey, (version) => ({
      ownerKey,
      valuationVersion: version,
      valuation,
    }));

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
        riskyVersion: version,
        riskyTokens,
        riskyMap,
        storeData,
      }));
    }
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
  }: {
    ownerKey: string;
  }): Promise<ITokenListFramesPullResult> {
    const frames = this.frames.getFrames(ownerKey);
    const structureP = frames.structure.payload;
    const valuationP = frames.valuation.payload;
    const riskyP = frames.risky.payload;
    return {
      ownerKey,
      structureVersion: frames.structure.version,
      valuationVersion: frames.valuation.version,
      structure: structureP?.structure,
      valuation: valuationP?.valuation,
      riskyVersion: frames.risky.version,
      riskyTokens: riskyP?.riskyTokens ?? [],
      riskyMap: riskyP?.riskyMap ?? {},
      // The risky frame apply needs the owner's storeData for the identity check;
      // the structure/valuation snapshots already carry it, so reuse whichever is
      // present (both are stamped for the same owner).
      storeData:
        structureP?.structure.storeData ?? valuationP?.valuation.storeData,
    };
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
