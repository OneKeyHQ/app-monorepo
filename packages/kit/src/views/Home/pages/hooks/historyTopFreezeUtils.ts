import type { IAccountHistoryTx } from '@onekeyhq/shared/types/history';

// Scroll thresholds (px) with hysteresis so the freeze state can't flap while
// the user lingers near the boundary. "Away from top" ENGAGES once the scroll
// offset passes FREEZE_ENGAGE_OFFSET, and only RELEASES again after the user
// scrolls back under FREEZE_RELEASE_OFFSET — i.e. close to the top, where
// inserting rows above the viewport shifts content by a negligible amount and
// cannot produce visible jitter.
export const FREEZE_ENGAGE_OFFSET = 160;
export const FREEZE_RELEASE_OFFSET = 48;

// Choose the rows the native history list should actually render.
//
// Root cause of OK-57070: the native (collapsible-tab) SectionList renders
// variable-height rows with no exact `getItemLayout`. When a background refresh
// prepends a brand-new tx at the top while the user is scrolled far down, the
// content above the viewport grows and RN re-estimates offsets every frame —
// which, fed back through collapsible-tab-view's content-size-driven scroll
// clamp, makes the list jitter up and down.
//
// The fix freezes top growth while the user is away from the top: we anchor on
// the first already-displayed row that still exists in `combined` and render
// from there downward, holding back the newly prepended leading rows. Crucially
// this still renders bottom growth from load-more (those rows sit AFTER the
// anchor), so pagination keeps working — only the new top rows wait until the
// user returns near the top (where re-inserting them is jitter-free).
export function selectVisibleHistoryRows({
  combined,
  displayedIds,
  isAwayFromTop,
  enabled,
}: {
  combined: IAccountHistoryTx[];
  displayedIds: Set<string>;
  isAwayFromTop: boolean;
  enabled: boolean;
}): IAccountHistoryTx[] {
  if (!enabled || !isAwayFromTop || combined.length === 0) {
    return combined;
  }

  let anchorIndex = 0;
  while (
    anchorIndex < combined.length &&
    !displayedIds.has(combined[anchorIndex].id)
  ) {
    anchorIndex += 1;
  }

  // No previously-displayed row survives in `combined` — this is a wholesale
  // replacement (identity switch / hard pagination reset), not a top prepend.
  // Render it live; freezing here would blank the list.
  if (anchorIndex >= combined.length) {
    return combined;
  }

  // combined[0..anchorIndex) are the freshly prepended rows to hold back.
  return anchorIndex === 0 ? combined : combined.slice(anchorIndex);
}

// Cheap id-sequence equality so the hook can skip a state write (and the list
// re-render it triggers) when a poll produces a list with the same rows in the
// same order — e.g. the common case of a refresh that brought no new tx.
export function isSameIdSequence(
  a: IAccountHistoryTx[],
  b: IAccountHistoryTx[],
): boolean {
  if (a === b) {
    return true;
  }
  if (a.length !== b.length) {
    return false;
  }
  for (let i = 0; i < a.length; i += 1) {
    if (a[i].id !== b[i].id) {
      return false;
    }
  }
  return true;
}

// Reference equality of the visible rows, used by the freeze hook to decide
// whether a re-render can be skipped. Comparing ids alone (isSameIdSequence) is
// too loose here: a poll can return the SAME tx ids whose objects were rebuilt
// with updated content (pending -> confirmed / replaced, or backend-backfilled
// fields). Skipping on id equality would keep the old object references on
// screen, freezing stale content until a row is added/removed or the list
// refocuses. Object identity changes whenever the upstream rebuilds a tx, so a
// reference check lets genuine in-place updates flow through while still
// skipping true no-op polls that reuse the same row objects. Re-rendering the
// same ids in place never re-inserts at the top, so it cannot reintroduce the
// OK-57070 jitter (which only the held-back leading rows can cause).
export function isSameRowsByReference(
  a: IAccountHistoryTx[],
  b: IAccountHistoryTx[],
): boolean {
  if (a === b) {
    return true;
  }
  if (a.length !== b.length) {
    return false;
  }
  for (let i = 0; i < a.length; i += 1) {
    if (a[i] !== b[i]) {
      return false;
    }
  }
  return true;
}
