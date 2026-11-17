/**
 * TokenList cells — synchronous OWNER-SWITCH replay (OK-63873).
 *
 * Fans the frames remembered for an owner (`ownerFrameReplayCache`) back
 * through the UNCHANGED apply contract so an account/network switch paints the
 * target owner's rows BEFORE the first frame instead of a skeleton. The replay
 * is PROVISIONAL, exactly like the cold-start paint: after applying, the
 * projection generation is reset to -1 so the very next real structure frame
 * (the PULL, or a fresh gen-0 round after a BG owner eviction) always
 * supersedes it — never dropped by apply's generation guard.
 */
import type { IJotaiContextStoreData } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import type { IStructureSnapshot } from '@onekeyhq/kit-bg/src/states/jotai/contexts/tokenList/cellsPure/types';

import {
  applyRiskyFrame,
  applyStructureSnapshot,
  applyValuationFrame,
} from './apply';

import type { IApplyDeps } from './apply';
import type { IOwnerReplayFrames } from './ownerFrameReplayCache';
import type { IStoreProjection } from './projection';
import type { IJotaiContextStore } from '../../../utils/createJotaiContext';

export interface IReplayOwnerFramesResult {
  /** a structure frame was replayed (rows painted). */
  structure: boolean;
  /** a risky frame was replayed (the owner reset must not blank it). */
  risky: boolean;
}

/**
 * Bookkeeping for "which owner had its risky frame replayed", shared by BOTH
 * replay entry points (the account-selector fast path and the layout-effect
 * fallback) so the owner reset never blanks a risky list that was replayed a
 * moment earlier. The two entries run back to back for one switch: the first
 * does the real replay, the second hits the idempotence short-circuit
 * (`{ structure: false, risky: false }`) because the projection is already
 * stamped for the owner. That second result means "already painted", not
 * "nothing replayed", so it must KEEP the record the first entry made.
 *
 * Returns the owner to remember (or undefined) and whether a risky frame is
 * on screen for `ownerKey`.
 */
export function resolveReplayedRiskyOwner({
  replayed,
  alreadyStamped,
  previous,
  ownerKey,
}: {
  replayed: IReplayOwnerFramesResult;
  /** projection.curOwnerKey === ownerKey after the replay call. */
  alreadyStamped: boolean;
  previous: string | undefined;
  ownerKey: string;
}): { next: string | undefined; risky: boolean } {
  if (replayed.structure) {
    return {
      next: replayed.risky ? ownerKey : undefined,
      risky: replayed.risky,
    };
  }
  if (alreadyStamped) {
    const risky = previous === ownerKey;
    return { next: risky ? ownerKey : undefined, risky };
  }
  return { next: undefined, risky: false };
}

/**
 * Replay `frames` for `ownerKey` into `store`. Returns what was replayed.
 * Guards:
 *   - currency mismatch -> nothing (stale fiat would paint a wrong number);
 *   - no structure frame -> nothing (valuation cannot lazy-build cells);
 *   - frames stamped for another owner -> nothing (defensive).
 * Idempotent per owner: if the projection is already stamped for `ownerKey`
 * (cold-start hydrate or a live frame landed first) it does not re-apply.
 */
export function replayOwnerFrames({
  store,
  projection,
  deps,
  frames,
  storeData,
  ownerKey,
  currentCurrency,
}: {
  store: IJotaiContextStore;
  projection: IStoreProjection;
  deps: IApplyDeps;
  frames: IOwnerReplayFrames | undefined;
  storeData: IJotaiContextStoreData;
  ownerKey: string;
  currentCurrency: string;
}): IReplayOwnerFramesResult {
  const none: IReplayOwnerFramesResult = { structure: false, risky: false };
  if (!frames || !ownerKey || !currentCurrency) {
    return none;
  }
  if (frames.currencyId !== currentCurrency) {
    return none;
  }
  const structure = frames.structure?.structure;
  if (!structure || structure.ownerKey !== ownerKey) {
    return none;
  }
  // An empty remembered list is not worth painting: for a funded owner it is
  // a round that had not landed yet (a brand-new account, a seed before the
  // default tokens loaded) and would show the empty state for a beat before
  // the rows arrive. The skeleton until the PULL is the honest paint, and a
  // genuinely empty owner reaches its empty state through that PULL.
  if (isEmptyStructure(structure)) {
    return none;
  }
  // Already stamped for this owner — by the cold-start hydrate (provisional,
  // generation -1), an earlier replay, or a live frame. Either way the paint
  // on screen is this owner's; re-applying would only clear and rebuild it.
  if (projection.curOwnerKey === ownerKey) {
    return none;
  }

  // Re-stamp storeData to THIS store so apply's identity guard passes (the
  // remembered payload may have been stamped for a sibling mount).
  applyStructureSnapshot(store, projection, { ...structure, storeData }, deps);

  const valuation = frames.valuation?.valuation;
  if (valuation && valuation.ownerKey === ownerKey) {
    applyValuationFrame(
      store,
      projection,
      { ...valuation, storeData },
      deps,
      (fn) => fn(),
    );
  }

  let risky = false;
  const riskyPush = frames.risky;
  if (riskyPush && riskyPush.ownerKey === ownerKey) {
    applyRiskyFrame(
      store,
      {
        riskyTokens: riskyPush.riskyTokens,
        riskyMap: riskyPush.riskyMap,
        storeData,
        ownerKey,
      },
      deps,
    );
    risky = true;
  }

  // Provisional paint: let the next real frame of any generation win, and
  // keep the persist from writing this replay back as the owner's list.
  projection.curGeneration = -1;
  projection.lastRoundProvisional = true;
  return { structure: true, risky };
}

function isEmptyStructure(structure: IStructureSnapshot): boolean {
  return (
    structure.orderedIds.length === 0 &&
    structure.smallBalanceIds.length === 0 &&
    Object.keys(structure.aggMembership ?? {}).length === 0
  );
}
