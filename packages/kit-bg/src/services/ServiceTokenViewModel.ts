/**
 * TokenList SLC — Phase-2 BG ServiceTokenViewModel (design §3, §4, D2=A).
 *
 * Owns the FRAME PRODUCTION in the BG heap. For each fetch round the home
 * refresh flow hands it the already-settled slices via `ingestRound`; the
 * service builds the two wire frames with the pure `buildFrames` (reused from
 * the relocated slcPure trio — kit-bg internal, no React/native/jotai), keeps
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
 * `useTokenListSlcProducer` + legacy atoms still own the UI). Cut-over is PR-2.
 */
import {
  backgroundClass,
  backgroundMethod,
} from '@onekeyhq/shared/src/background/backgroundDecorators';
import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
import type {
  IAccountToken,
  ICustomTokenItem,
  IHomeDefaultToken,
  IToken,
  ITokenFiat,
} from '@onekeyhq/shared/types/token';

import { buildFrames } from '../states/jotai/contexts/tokenList/slcPure/buildFrames';

import ServiceBase from './ServiceBase';

import type { IJotaiContextStoreData } from '../states/jotai/atoms';
import type {
  IBuildFramesInput,
  IBuildFramesPrev,
} from '../states/jotai/contexts/tokenList/slcPure/buildFrames';
import type {
  IAggKey,
  INetworkId,
  IStructureSnapshot,
  ITokenKey,
  IValuationFrame,
} from '../states/jotai/contexts/tokenList/slcPure/types';

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
  smallBalanceFiatValue: string;
  /** identity-check payload routed through to the frames (see resolveCurrentStore). */
  storeData: IJotaiContextStoreData;
  /** hideZero "keep default zero-balance" inputs (design §3, spec §8#2). */
  keepDefault?: boolean;
  homeDefaultTokenMap?: Record<string, IHomeDefaultToken>;
  customTokens?: ICustomTokenItem[];
}

/** Result of a PULL — the authoritative full frames for an owner. */
export interface ITokenListFramesPullResult {
  ownerKey: string;
  structureVersion: number;
  valuationVersion: number;
  structure: IStructureSnapshot | undefined;
  valuation: IValuationFrame | undefined;
}

@backgroundClass()
class ServiceTokenViewModel extends ServiceBase {
  constructor({ backgroundApi }: { backgroundApi: any }) {
    super({ backgroundApi });
  }

  /** Per-owner view-model state. Lives in the BG heap; never persisted. */
  private vmByOwner: Map<string, IOwnerVM> = new Map();

  /** A fresh, empty owner VM (generation starts at -1, like the UI producer). */
  private createOwnerVM(ownerKey: string): IOwnerVM {
    return {
      ownerKey,
      lastStructure: {
        orderedIds: [],
        smallBalanceIds: [],
        nonZeroIds: [],
        aggMembership: {},
        ownerKey: '',
        generation: -1,
      },
      lastScalar: '0',
      lastMetaByKey: {},
      structureVersion: -1,
      valuationVersion: -1,
      lastStructureSnapshot: undefined,
      lastValuationFrame: undefined,
    };
  }

  /**
   * Ingest ONE fetch round for an owner: build the two frames via the pure
   * `buildFrames`, update the `prev` refs on a structural change, bump the
   * monotonic version counters, then PUSH the frames over appEventBus.
   *
   * SYNCHRONOUS: no await/nextTick/microtask anywhere in this method.
   */
  ingestRound(params: IIngestRoundParams): void {
    const {
      ownerKey,
      orderedTokens,
      smallBalanceTokens,
      tokenListMap,
      aggregateTokensMap,
      smallBalanceFiatValue,
      storeData,
      keepDefault,
      homeDefaultTokenMap,
      customTokens,
    } = params;

    if (!ownerKey) {
      return;
    }

    let vm = this.vmByOwner.get(ownerKey);
    if (!vm) {
      vm = this.createOwnerVM(ownerKey);
      this.vmByOwner.set(ownerKey, vm);
    }

    const input: IBuildFramesInput = {
      orderedTokens,
      smallBalanceTokens,
      tokenListMap,
      aggregateTokensMap,
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
        aggMembership: structure.aggMembership,
        ownerKey: structure.ownerKey,
        generation: structure.generation,
      };
      vm.lastScalar = structure.smallBalanceFiatValue;
      vm.lastMetaByKey = this.metaByKeyFromTokens([
        ...orderedTokens,
        ...smallBalanceTokens,
      ]);
      vm.structureVersion = structure.generation;
      vm.lastStructureSnapshot = structure;

      appEventBus.emit(EAppEventBusNames.TokenListSlcStructureFrame, {
        ownerKey,
        structureVersion: vm.structureVersion,
        structure,
      });
    }

    appEventBus.emit(EAppEventBusNames.TokenListSlcValuationFrame, {
      ownerKey,
      valuationVersion: vm.valuationVersion,
      valuation,
    });
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
      };
    }
    return {
      ownerKey,
      structureVersion: vm.structureVersion,
      valuationVersion: vm.valuationVersion,
      structure: vm.lastStructureSnapshot,
      valuation: vm.lastValuationFrame,
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
