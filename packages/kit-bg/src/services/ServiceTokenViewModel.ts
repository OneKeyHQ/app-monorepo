/**
 * TokenList cells — Phase-2 BG ServiceTokenViewModel (design §3, §4, D2=A).
 *
 * Owns the FRAME PRODUCTION in the BG heap. For each fetch round the home
 * refresh flow hands it the already-settled slices via `ingestRound`; the
 * service builds the two wire frames with the pure `buildFrames` (reused from
 * the relocated cellsPure trio — kit-bg internal, no React/native/jotai), keeps
 * the per-owner `prev` refs + monotonic version counters, and PUSHES the frames
 * over the two new appEventBus events. `getTokenListFrames` is the authoritative
 * PULL backstop the UI shell uses on mount / owner switch / generation gap.
 *
 * SYNCHRONOUS INVARIANT (design §7 risk, MEMORY bg-runtime-nexttick-dead):
 *   - `buildFrames` + the BigNumber summation it relies on are synchronous.
 *   - The whole frame-production path here (ingestRound → buildFrames → emit)
 *     MUST stay synchronous: NO await / nextTick / microtask. BG nextTick is
 *     dead on v6.3.0 Android, so any async hop would silently hang the VM.
 *
 * PR-1 STATUS (design §5 step 2): DARK / flag-OFF. The home refresh flow
 * dual-writes into this service only when its module flag is ON (default OFF),
 * and the UI is NOT driven by these frames yet (the existing
 * `useTokenListCellsProducer` + legacy atoms still own the UI). Cut-over is PR-2.
 */
import {
  backgroundClass,
  backgroundMethod,
} from '@onekeyhq/shared/src/background/backgroundDecorators';
import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
import { flattenAggregateTokensMap } from '@onekeyhq/shared/src/utils/tokenUtils';
import type {
  IAccountToken,
  ICustomTokenItem,
  IHomeDefaultToken,
  IToken,
  ITokenFiat,
} from '@onekeyhq/shared/types/token';

import { buildFrames } from '../states/jotai/contexts/tokenList/cellsPure/buildFrames';

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
 * One owner's BG view-model state. Mirrors the UI producer's `prev` refs
 * (`lastStructure` / `lastScalar` / `lastMetaByKey`) plus the monotonic version
 * counters and the most-recently-built full frames (the PULL backstop).
 */
interface IOwnerVM {
  ownerKey: string;
  /** the structure half of `IBuildFramesPrev` (ids/membership/owner/gen). */
  lastStructure: IBuildFramesPrev['structure'];
  /** previously-applied smallBalanceFiatValue scalar. */
  lastScalar: string;
  /** previously-applied meta by `$key`, for meta-change detection. */
  lastMetaByKey: Record<ITokenKey, IToken | undefined>;
  /** monotonic; equals the last emitted structure `generation`. */
  structureVersion: number;
  /** monotonic; bumped on EVERY emit (structure or pure valuation tick). */
  valuationVersion: number;
  /** last full structure snapshot emitted for this owner (PULL backstop). */
  lastStructureSnapshot: IStructureSnapshot | undefined;
  /** last full valuation frame emitted for this owner (PULL backstop). */
  lastValuationFrame: IValuationFrame | undefined;
  /**
   * monotonic risky-frame version, INDEPENDENT of structure/valuation. Bumped
   * only when the risky change-gate fires (membership OR a per-`$key` balance
   * change), NOT on a pure price tick. Owner-switch resets it to -1.
   */
  riskyVersion: number;
  /** last full risky snapshot emitted for this owner (PULL backstop + gate). */
  lastRisky: IRiskySnapshot | undefined;
  /**
   * Most-recently-ingested RAW slices for this owner (the `getRawTokenList` /
   * `getAllTokenListMap` PULL source). REPLACED (not concatenated) each round.
   * Kept separate from the frames so the large raw list is PULL-only and never
   * pushed over appEventBus (design §4 "推小拉大").
   */
  lastRaw: IRawTokenListData;
}

/**
 * The risky snapshot kept on the owner VM (PULL backstop) and compared by the
 * synchronous change-gate. The list + map are the full current risky set.
 */
interface IRiskySnapshot {
  riskyTokens: IAccountToken[];
  riskyMap: Record<ITokenKey, ITokenFiat>;
}

/**
 * Raw token-list data for an owner — the merged-with-risky list plus the settled
 * owner identity the switch skeleton needs (design §R0 #3, red-team C-F1: the
 * `allTokenList.accountId/networkId` is the PREVIOUS settled owner, deliberately
 * lagging the scoped current owner; it must survive verbatim so `ownerMismatch`
 * keeps firing).
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

@backgroundClass()
class ServiceTokenViewModel extends ServiceBase {
  constructor({ backgroundApi }: { backgroundApi: any }) {
    super({ backgroundApi });
  }

  /**
   * Per-owner view-model state. Lives in the BG heap; never persisted.
   * Insertion-ordered as a MRU: `ingestRound` re-inserts the touched owner at
   * the tail, and a size overflow evicts the head (least-recently ingested) so
   * the map cannot grow unbounded across owner switches (design §5 PR-2 step 4).
   * Eviction is BG-memory only — a PULL for an evicted owner returns the empty
   * (-1) result and the UI shell falls back to skeleton until the next round
   * re-creates the owner VM.
   */
  private vmByOwner: Map<string, IOwnerVM> = new Map();

  /**
   * MRU cap on `vmByOwner`. Bounds BG heap growth across owner switches; 8 is
   * comfortably above the count of stores a single session paints concurrently
   * (home + urlAccount + a transient switch target).
   */
  private static readonly OWNER_VM_CAP = 8;

  /**
   * Get-or-create the owner VM and mark it most-recently-used (re-insert at the
   * Map tail). After a create, evict the LRU (head) owner(s) past the cap.
   */
  private touchOwnerVM(ownerKey: string): IOwnerVM {
    let vm = this.vmByOwner.get(ownerKey);
    if (vm) {
      // Re-insert at the tail so this owner becomes MRU.
      this.vmByOwner.delete(ownerKey);
      this.vmByOwner.set(ownerKey, vm);
      return vm;
    }
    vm = this.createOwnerVM(ownerKey);
    this.vmByOwner.set(ownerKey, vm);
    // Evict LRU owners (Map iteration order = insertion order = LRU-first).
    while (this.vmByOwner.size > ServiceTokenViewModel.OWNER_VM_CAP) {
      const lruKey = this.vmByOwner.keys().next().value;
      if (lruKey === undefined || lruKey === ownerKey) {
        break;
      }
      this.vmByOwner.delete(lruKey);
    }
    return vm;
  }

  /** A fresh, empty owner VM (generation starts at -1, like the UI producer). */
  private createOwnerVM(ownerKey: string): IOwnerVM {
    return {
      ownerKey,
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
      structureVersion: -1,
      valuationVersion: -1,
      lastStructureSnapshot: undefined,
      lastValuationFrame: undefined,
      riskyVersion: -1,
      lastRisky: undefined,
      lastRaw: {
        tokens: [],
        keys: '',
        accountId: undefined,
        networkId: undefined,
        tokenListMap: {},
        aggregateTokensMap: {},
      },
    };
  }

  /**
   * Ingest ONE fetch round for an owner: build the two frames via the pure
   * `buildFrames`, update the `prev` refs on a structural change, bump the
   * monotonic version counters, then PUSH the frames over appEventBus.
   *
   * SYNCHRONOUS body: no await/nextTick/microtask anywhere in this method (the
   * `async`/`Promise<void>` is only the @backgroundMethod RPC contract so the UI
   * can feed the BG VM across the runtime boundary — the body runs synchronously
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

    // Get-or-create + mark MRU + evict LRU past the cap. `ingestRound` REPLACES
    // (not concats) the owner's slices each round: `buildFrames` takes the full
    // current input and `vm.lastStructure` compares full-vs-full, so a coherent
    // merged snapshot fed by the UI (design §5 PR-2 step 1) yields a structure
    // frame that reflects the whole current list, not one incremental round.
    const vm = this.touchOwnerVM(ownerKey);

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
      structure: vm.lastStructure,
      smallBalanceFiatValue: vm.lastScalar,
      metaByKey: vm.lastMetaByKey,
    };

    const { structure, valuation } = buildFrames(input, prev);

    // Valuation is emitted on EVERY round (the full current fiat map is
    // idempotent + self-healing). Bump the valuation version each time.
    vm.valuationVersion += 1;
    vm.lastValuationFrame = valuation;

    if (structure) {
      // Structural change — advance the prev refs so the next round compares
      // against what we just emitted, and record the monotonic structure
      // version (== the structure's own generation).
      vm.lastStructure = {
        orderedIds: structure.orderedIds,
        smallBalanceIds: structure.smallBalanceIds,
        nonZeroIds: structure.nonZeroIds,
        fundedIds: structure.fundedIds,
        aggMembership: structure.aggMembership,
        ownerKey: structure.ownerKey,
        generation: structure.generation,
        ownedAggregateTokenListMap: structure.ownedAggregateTokenListMap,
      };
      vm.lastScalar = structure.smallBalanceFiatValue;
      vm.lastMetaByKey = this.metaByKeyFromTokens([
        ...orderedTokens,
        ...smallBalanceTokens,
      ]);
      vm.structureVersion = structure.generation;
      vm.lastStructureSnapshot = structure;

      appEventBus.emit(EAppEventBusNames.TokenListStructureFrame, {
        ownerKey,
        structureVersion: vm.structureVersion,
        structure,
      });
    }

    appEventBus.emit(EAppEventBusNames.TokenListValuationFrame, {
      ownerKey,
      valuationVersion: vm.valuationVersion,
      valuation,
    });

    // --- raw token list (PULL-only source) ---------------------------------
    // REPLACE (not concat) the owner's raw slices each round: the merged list is
    // [...orderedTokens, ...smallBalanceTokens, ...riskyTokens] (mirrors the
    // legacy `allTokenListAtom` write `[...mergedTokens, ...riskyTokens]`), kept
    // for the `getRawTokenList` PULL together with the SETTLED owner identity
    // the switch skeleton compares against (red-team C-F1). Never pushed.
    vm.lastRaw = {
      tokens: [...orderedTokens, ...smallBalanceTokens, ...riskyTokens],
      keys: rawKeys,
      accountId,
      networkId,
      tokenListMap,
      aggregateTokensMap,
    };

    // --- risky frame (design §R0 #2) ---------------------------------------
    // SYNCHRONOUS change-gate: emit a FULL idempotent risky snapshot only when
    // the risky set changes by membership ($key set) OR by a per-`$key` BALANCE
    // change (red-team C-F4: footer filters `riskyMap[$key].balance>0`, so a
    // balance crossing 0 on an existing risky token must re-emit even though
    // membership is unchanged). A pure price tick (same $keys + same balances)
    // does NOT emit. The comparison is a sync shallowEqual (NO awaited hash —
    // red-team R-#1: an async hop would break the synchronous BG invariant and
    // silently hang on v6.3.0 Android).
    if (this.riskyChanged(vm.lastRisky, riskyTokens, riskyMap)) {
      vm.riskyVersion += 1;
      vm.lastRisky = { riskyTokens, riskyMap };
      appEventBus.emit(EAppEventBusNames.TokenListRiskyFrame, {
        ownerKey,
        riskyVersion: vm.riskyVersion,
        riskyTokens,
        riskyMap,
        storeData,
      });
    }
  }

  /**
   * SYNCHRONOUS risky change-gate (design §R0 #2, red-team C-F4 / R-#1). Returns
   * true when the risky set differs from the previously-emitted snapshot by
   * either its `$key` membership OR any per-`$key` balance. A pure price-only
   * move (same $keys + same balances) returns false so no risky frame is emitted.
   * Mirrors the style of `buildFrames`'s `aggMembershipEqual` — all in-memory,
   * no await / hash.
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
   * PULL backstop (design §4, D2=A). Returns the current full structure
   * snapshot + full valuation frame for the owner, with their monotonic
   * versions. Returns an empty (undefined frames, -1 versions) result when the
   * owner is unknown so the UI shell can no-op the apply.
   */
  @backgroundMethod()
  async getTokenListFrames({
    ownerKey,
  }: {
    ownerKey: string;
  }): Promise<ITokenListFramesPullResult> {
    const vm = this.vmByOwner.get(ownerKey);
    if (!vm) {
      return {
        ownerKey,
        structureVersion: -1,
        valuationVersion: -1,
        structure: undefined,
        valuation: undefined,
        riskyVersion: -1,
        riskyTokens: [],
        riskyMap: {},
        storeData: undefined,
      };
    }
    return {
      ownerKey,
      structureVersion: vm.structureVersion,
      valuationVersion: vm.valuationVersion,
      structure: vm.lastStructureSnapshot,
      valuation: vm.lastValuationFrame,
      riskyVersion: vm.riskyVersion,
      riskyTokens: vm.lastRisky?.riskyTokens ?? [],
      riskyMap: vm.lastRisky?.riskyMap ?? {},
      // The risky frame apply needs the owner's storeData for the identity check;
      // the structure/valuation snapshots already carry it, so reuse whichever is
      // present (both are stamped for the same owner).
      storeData:
        vm.lastStructureSnapshot?.storeData ?? vm.lastValuationFrame?.storeData,
    };
  }

  /**
   * PULL-only raw token list (design §R0 #3, "推小拉大": the largest payload is
   * NEVER pushed). Returns the owner's merged-with-risky raw list AND the SETTLED
   * owner identity (accountId/networkId/keys) the switch skeleton compares
   * against the scoped current owner (red-team C-F1: this lags on purpose so
   * `ownerMismatch` keeps firing on owner switch). Returns an empty list +
   * undefined identity for an unknown / evicted owner so the caller can fall
   * back to skeleton.
   */
  @backgroundMethod()
  async getRawTokenList({
    ownerKey,
  }: {
    ownerKey: string;
  }): Promise<IRawTokenListPullResult> {
    const vm = this.vmByOwner.get(ownerKey);
    if (!vm) {
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
      tokens: vm.lastRaw.tokens,
      keys: vm.lastRaw.keys,
      accountId: vm.lastRaw.accountId,
      networkId: vm.lastRaw.networkId,
    };
  }

  /**
   * PULL the FULL fiat map for an owner (design §R0 #4). Composed SYNCHRONOUSLY
   * as `{ ...tokenListMap, ...riskyMap, ...flatten(aggregateTokensMap) }` —
   * mirroring the legacy `allTokenListMapAtom` write. The flatten reuses the
   * existing pure `flattenAggregateTokensMap` (BigNumber-only, no await). Note:
   * this map keys aggregates by their AGGREGATE `$key` (summed across networks);
   * the per-network sub-token `$key` fiat is carried in `tokenListMap`/`riskyMap`
   * (red-team C-F2 / completeness-#9: `checkIsOnlyOneTokenHasBalance` reads per-network
   * sub-token `$key`, which lives in `tokenListMap`, NOT in the flattened agg).
   * Returns an empty map for an unknown / evicted owner.
   */
  @backgroundMethod()
  async getAllTokenListMap({
    ownerKey,
  }: {
    ownerKey: string;
  }): Promise<Record<ITokenKey, ITokenFiat>> {
    const vm = this.vmByOwner.get(ownerKey);
    if (!vm) {
      return {};
    }
    const { tokenListMap, aggregateTokensMap } = vm.lastRaw;
    const riskyMap: Record<ITokenKey, ITokenFiat> =
      vm.lastRisky?.riskyMap ?? {};
    return {
      ...tokenListMap,
      ...riskyMap,
      ...flattenAggregateTokensMap(aggregateTokensMap),
    };
  }

  /**
   * `$key -> IToken` snapshot (stripping `$key`) for meta-change detection.
   * Mirrors the relocated `metaByKeyFromTokens` so the BG keeps an internal,
   * synchronous copy without reaching into the UI producer.
   */
  private metaByKeyFromTokens(
    tokens: IAccountToken[],
  ): Record<ITokenKey, IToken> {
    const out: Record<ITokenKey, IToken> = {};
    for (const token of tokens) {
      const { $key, ...rest } = token;
      out[$key] = rest;
    }
    return out;
  }
}

export default ServiceTokenViewModel;
