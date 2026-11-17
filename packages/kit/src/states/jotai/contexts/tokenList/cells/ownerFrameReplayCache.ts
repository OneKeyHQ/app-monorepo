/**
 * TokenList cells — MAIN-heap per-owner frame REPLAY cache (OK-63873).
 *
 * The BG `ServiceTokenViewModel` keeps a per-owner frame cache, but reaching it
 * is an async RPC: on an account/network switch the projection is stamped with
 * the previous owner until the PULL resolves, `ownerMismatch` fires and the
 * home list paints a skeleton for a few frames even when the target owner was
 * on screen seconds ago. This module keeps the LAST APPLIED push payload per
 * (storeName, ownerKey, kind) on the main heap so the receive shell can replay
 * it SYNCHRONOUSLY (in a layout effect, before paint) when the owner changes.
 *
 * Pure, module-level, bounded: an insertion-ordered Map used as an LRU with
 * the same owner cap the BG host uses. Payloads are the exact objects the
 * shell already applied, so remembering them costs no copy.
 */
import type { IJotaiContextStoreData } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import type {
  IStructureSnapshot,
  IValuationFrame,
} from '@onekeyhq/kit-bg/src/states/jotai/contexts/tokenList/cellsPure/types';
import { flattenAggregateTokensMap } from '@onekeyhq/shared/src/utils/tokenUtils';
import type {
  IAccountToken,
  IToken,
  ITokenFiat,
} from '@onekeyhq/shared/types/token';

export interface IStructurePush {
  ownerKey: string;
  slotId?: string;
  baseVersion?: number;
  isDelta?: boolean;
  structureVersion: number;
  structure: IStructureSnapshot;
}
export interface IValuationPush {
  ownerKey: string;
  slotId?: string;
  baseVersion?: number;
  isDelta?: boolean;
  valuationVersion: number;
  valuation: IValuationFrame;
}
export interface IRiskyPush {
  ownerKey: string;
  slotId?: string;
  riskyVersion: number;
  riskyTokens: IAccountToken[];
  riskyMap: Record<string, ITokenFiat>;
}
export interface IFramesPull {
  ownerKey: string;
  slotId?: string;
  structureVersion: number;
  valuationVersion: number;
  structure: IStructureSnapshot | undefined;
  structureUnchanged?: boolean;
  valuation: IValuationFrame | undefined;
  valuationUnchanged?: boolean;
  riskyVersion: number;
  riskyTokens: IAccountToken[];
  riskyMap: Record<string, ITokenFiat>;
  riskyUnchanged?: boolean;
  storeData?: IJotaiContextStoreData;
}

export type IOwnerReplayFrameKind = 'structure' | 'valuation' | 'risky';

export interface IOwnerReplayFrames {
  /** settings currency the valuation fiat values are stored in. */
  currencyId: string;
  structure?: IStructurePush;
  valuation?: IValuationPush;
  risky?: IRiskyPush;
}

interface IOwnerReplayPayloadByKind {
  structure: IStructurePush;
  valuation: IValuationPush;
  risky: IRiskyPush;
}

/** Mirrors the BG `FrameChannelHost` owner cap (`OWNER_VM_CAP`). */
export const OWNER_REPLAY_CACHE_CAP = 32;

// Keyed by `${storeName}\u0000${ownerKey}`; insertion order = LRU order (the
// head is the least recently used owner).
const replayCache = new Map<string, IOwnerReplayFrames>();

function buildReplayKey(storeName: string, ownerKey: string): string {
  return `${storeName}\u0000${ownerKey}`;
}

function pruneValuationToStructure(
  valuation: IValuationFrame,
  structure: IStructureSnapshot | undefined,
): IValuationFrame {
  if (!structure) {
    return valuation;
  }
  const liveKeys = new Set<string>([
    ...structure.orderedIds,
    ...structure.smallBalanceIds,
  ]);
  const aggMembership = structure.aggMembership ?? {};
  const prunedFiatById: Record<string, ITokenFiat> = {};
  for (const [k, fiat] of Object.entries(valuation.changedFiatById)) {
    if (liveKeys.has(k) && !(k in aggMembership)) {
      prunedFiatById[k] = fiat;
    }
  }
  const prunedAggFiat: Record<string, Record<string, ITokenFiat>> = {};
  for (const [aggKey, members] of Object.entries(aggMembership)) {
    const byNet = valuation.changedAggFiat[aggKey];
    if (byNet && members.length > 0) {
      const memberSet = new Set<string>(members);
      let nextByNet: Record<string, ITokenFiat> | undefined;
      for (const [netId, fiat] of Object.entries(byNet)) {
        if (memberSet.has(netId)) {
          nextByNet ??= {};
          nextByNet[netId] = fiat;
        }
      }
      if (nextByNet) {
        prunedAggFiat[aggKey] = nextByNet;
      }
    }
  }
  return {
    ...valuation,
    changedFiatById: prunedFiatById,
    changedAggFiat: prunedAggFiat,
  };
}

/**
 * Record the payload the shell just applied for `(storeName, ownerKey, kind)`.
 * A currency change drops the owner's remembered valuation and risky frames
 * (their fiat values are in the old currency) but keeps the structure: the
 * background re-emits a structure frame whenever the order or the small-balance
 * fiat scalar changes, so a new-currency round that pushes only a valuation
 * means the remembered structure still holds.
 */
export function rememberOwnerReplayFrame<K extends IOwnerReplayFrameKind>({
  storeName,
  ownerKey,
  kind,
  payload,
  currencyId,
}: {
  storeName: string;
  ownerKey: string;
  kind: K;
  payload: IOwnerReplayPayloadByKind[K];
  currencyId: string;
}): void {
  if (!storeName || !ownerKey) {
    return;
  }
  const key = buildReplayKey(storeName, ownerKey);
  const existing = replayCache.get(key);
  // Re-insert on every touch so the Map order stays LRU.
  replayCache.delete(key);
  let base: IOwnerReplayFrames = { currencyId };
  if (existing?.currencyId === currencyId) {
    base = existing;
  } else if (existing?.structure) {
    base = { currencyId, structure: existing.structure };
  }
  let storedPayload: IOwnerReplayPayloadByKind[K] = payload;
  if (kind === 'structure') {
    const structPush = payload as IStructurePush;
    if (structPush.isDelta) {
      const prevStruct = base.structure;
      const canFold =
        prevStruct &&
        prevStruct.structureVersion === structPush.baseVersion &&
        (!structPush.slotId ||
          !prevStruct.slotId ||
          prevStruct.slotId === structPush.slotId);
      if (!canFold) {
        if (base.structure || base.valuation || base.risky) {
          replayCache.set(key, base);
        }
        return;
      }
      const liveKeys = new Set<string>([
        ...structPush.structure.orderedIds,
        ...structPush.structure.smallBalanceIds,
      ]);
      const prevMetaPatch = prevStruct.structure.metaPatch;
      const mergedMetaPatch: Record<string, IToken> = {};
      for (const k of liveKeys) {
        const nextMeta = structPush.structure.metaPatch[k] ?? prevMetaPatch[k];
        if (nextMeta) {
          mergedMetaPatch[k] = nextMeta;
        }
      }
      storedPayload = {
        ownerKey: structPush.ownerKey,
        ...(structPush.slotId ? { slotId: structPush.slotId } : undefined),
        structureVersion: structPush.structureVersion,
        structure: {
          ...structPush.structure,
          metaPatch: mergedMetaPatch,
        },
      } as IOwnerReplayPayloadByKind[K];
    }
  } else if (kind === 'valuation') {
    const valPush = payload as IValuationPush;
    if (valPush.isDelta) {
      const prevVal = base.valuation;
      const canFold =
        prevVal &&
        prevVal.valuationVersion === valPush.baseVersion &&
        (!valPush.slotId ||
          !prevVal.slotId ||
          prevVal.slotId === valPush.slotId);
      if (!canFold) {
        if (base.structure || base.valuation || base.risky) {
          replayCache.set(key, base);
        }
        return;
      }
      const mergedFiatById: Record<string, ITokenFiat> = {
        ...prevVal.valuation.changedFiatById,
        ...valPush.valuation.changedFiatById,
      };
      const mergedAggFiat: Record<string, Record<string, ITokenFiat>> = {
        ...prevVal.valuation.changedAggFiat,
      };
      for (const [aggKey, byNet] of Object.entries(
        valPush.valuation.changedAggFiat,
      )) {
        mergedAggFiat[aggKey] = {
          ...mergedAggFiat[aggKey],
          ...byNet,
        };
      }
      const prunedValuation = pruneValuationToStructure(
        {
          ...valPush.valuation,
          changedFiatById: mergedFiatById,
          changedAggFiat: mergedAggFiat,
        },
        base.structure?.structure,
      );
      storedPayload = {
        ownerKey: valPush.ownerKey,
        ...(valPush.slotId ? { slotId: valPush.slotId } : undefined),
        valuationVersion: valPush.valuationVersion,
        valuation: prunedValuation,
      } as IOwnerReplayPayloadByKind[K];
    }
  }
  const next: IOwnerReplayFrames = { ...base, [kind]: storedPayload };
  if (kind === 'structure' && next.valuation && next.structure) {
    next.valuation = {
      ...next.valuation,
      valuation: pruneValuationToStructure(
        next.valuation.valuation,
        next.structure.structure,
      ),
    };
  }
  replayCache.set(key, next);
  while (replayCache.size > OWNER_REPLAY_CACHE_CAP) {
    const lru = replayCache.keys().next().value;
    if (lru === undefined) {
      break;
    }
    replayCache.delete(lru);
  }
}

/**
 * The remembered frames for an owner, or undefined when unknown / evicted.
 * Reading also counts as a touch (the owner becomes most-recently-used), since
 * a replay means the user is looking at that owner again.
 */
export function getOwnerReplayFrames({
  storeName,
  ownerKey,
}: {
  storeName: string;
  ownerKey: string;
}): IOwnerReplayFrames | undefined {
  if (!storeName || !ownerKey) {
    return undefined;
  }
  const key = buildReplayKey(storeName, ownerKey);
  const frames = replayCache.get(key);
  if (!frames) {
    return undefined;
  }
  replayCache.delete(key);
  replayCache.set(key, frames);
  return frames;
}

// Bumped on every clear, so a caller filling the cache from an async answer
// can tell the cache was cleared (a wallet / account removal) while it waited.
let clearGeneration = 0;

/** Drop every remembered owner (tests / clear-data). */
export function clearOwnerReplayCache(): void {
  clearGeneration += 1;
  replayCache.clear();
}

export function getOwnerReplayCacheGeneration(): number {
  return clearGeneration;
}

/** Number of remembered owners (tests). */
export function getOwnerReplayCacheSize(): number {
  return replayCache.size;
}

export function tryBuildHomeSnapshotFromOwnerReplay({
  storeName = 'homeTokenList',
  ownerKey,
  generation,
}: {
  storeName?: string;
  ownerKey: string;
  generation: number;
}):
  | {
      tokens: IAccountToken[];
      keys: string;
      map: Record<string, ITokenFiat>;
      cacheKey: string;
      ownerKey: string;
      accountId: string | undefined;
      networkId: string | undefined;
    }
  | undefined {
  const replay = getOwnerReplayFrames({ storeName, ownerKey });
  const struct = replay?.structure?.structure;
  const val = replay?.valuation?.valuation;
  if (
    !struct ||
    !val ||
    struct.generation !== generation ||
    struct.rawKeys === undefined
  ) {
    return undefined;
  }
  if (
    val.structureGeneration !== undefined &&
    val.structureGeneration !== generation
  ) {
    return undefined;
  }
  if ((struct.riskyCount ?? 0) > 0) {
    return undefined;
  }
  const tokens: IAccountToken[] = [];
  for (const id of struct.orderedIds) {
    const tokenMeta = struct.metaPatch[id];
    if (!tokenMeta) {
      return undefined;
    }
    tokens.push({ ...tokenMeta, $key: id });
  }
  for (const id of struct.smallBalanceIds) {
    const tokenMeta = struct.metaPatch[id];
    if (!tokenMeta) {
      return undefined;
    }
    tokens.push({ ...tokenMeta, $key: id });
  }
  const map: Record<string, ITokenFiat> = {
    ...val.changedFiatById,
    ...flattenAggregateTokensMap(val.changedAggFiat),
  };
  return {
    tokens,
    keys: struct.rawKeys,
    map,
    cacheKey: `${ownerKey}@${generation}`,
    ownerKey,
    accountId: struct.settledAccountId,
    networkId: struct.settledNetworkId,
  };
}
