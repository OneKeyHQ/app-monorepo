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
// The fix freezes top growth while the user is away from the top: we keep the
// rows that were already displayed and render bottom growth from load-more
// (rows AFTER the last displayed row), while holding back every row a refresh
// inserted at or above the last displayed row — until the user returns near the
// top (where re-inserting them is jitter-free).
//
// A strict leading-prefix anchor is NOT enough: if a row stays put at the top
// (e.g. a long-lived local pending that keeps its position across refreshes),
// newer rows inserted BELOW it but still above the viewport would slip through
// and grow the content above the viewport — which is exactly the OK-57070
// jitter. So we hold back any newly inserted row within the displayed block,
// not just a contiguous leading run.
export function selectVisibleHistoryRows({
  combined,
  displayed,
  isAwayFromTop,
  enabled,
}: {
  combined: IAccountHistoryTx[];
  displayed: IAccountHistoryTx[];
  isAwayFromTop: boolean;
  enabled: boolean;
}): IAccountHistoryTx[] {
  if (!enabled || !isAwayFromTop || combined.length === 0) {
    return combined;
  }

  const displayedIds = new Set(displayed.map((tx) => tx.id));

  // The last row that was already displayed marks the boundary: everything
  // after it is bottom growth (load-more) that extends below the viewport and
  // is jitter-free, so it renders live.
  let lastDisplayedIndex = -1;
  for (let i = combined.length - 1; i >= 0; i -= 1) {
    if (displayedIds.has(combined[i].id)) {
      lastDisplayedIndex = i;
      break;
    }
  }

  // No previously-displayed row survives in `combined` — this is a wholesale
  // replacement (identity switch / hard pagination reset), not a top prepend.
  // Render it live; freezing here would blank the list.
  if (lastDisplayedIndex === -1) {
    return combined;
  }

  // Keep the previously displayed order within [0..lastDisplayedIndex], using
  // the latest row objects from `combined`, then append everything after it
  // (bottom growth). This also freezes pure reorders while away from the top:
  // an updatedAt/status refresh can move an existing row upward without adding
  // an id, but that still changes content above the viewport and can shift the
  // native SectionList offset.
  const visibleHeadById = new Map<string, IAccountHistoryTx>();
  for (let i = 0; i <= lastDisplayedIndex; i += 1) {
    visibleHeadById.set(combined[i].id, combined[i]);
  }
  const head = displayed
    .map((row) => visibleHeadById.get(row.id))
    .filter((row): row is IAccountHistoryTx => Boolean(row));

  const combinedHeadIds = combined
    .slice(0, lastDisplayedIndex + 1)
    .map((row) => row.id);
  const headIds = head.map((row) => row.id);
  const isDisplayedBlockUnchanged =
    combinedHeadIds.length === headIds.length &&
    combinedHeadIds.every((id, index) => id === headIds[index]);

  // Nothing new was inserted or reordered within the displayed block, so
  // `combined` already equals head + bottom growth. Return the original
  // reference so React can bail out of the re-render.
  if (isDisplayedBlockUnchanged) {
    return combined;
  }

  const tail = combined.slice(lastDisplayedIndex + 1);
  return tail.length === 0 ? head : head.concat(tail);
}
