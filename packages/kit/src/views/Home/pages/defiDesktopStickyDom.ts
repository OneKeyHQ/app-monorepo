export function findScrollableAncestorFromLocalNode(
  node: HTMLElement,
): HTMLElement | null {
  let current: HTMLElement | null = node.parentElement;

  while (current) {
    const { overflowY } = globalThis.getComputedStyle(current);
    const canScroll =
      (overflowY === 'auto' || overflowY === 'scroll') &&
      current.scrollHeight > current.clientHeight;

    if (canScroll) {
      return current;
    }

    current = current.parentElement;
  }

  return null;
}

export type IStickyProtocolCandidate = {
  key: string;
  top: number;
  bottom: number;
  width: number;
};

// Scroll-spy: returns the protocol whose top has most recently scrolled
// past (or sits exactly at) the sticky line. Stays valid through inter-
// protocol gaps and after scrolling beyond the last protocol's bottom.
// `<=` (not `<`) so a chip click landing a protocol exactly on the line
// also qualifies.
//
// Single-pass max-finder rather than `filter().toSorted()`: this runs
// once per rAF on the page scroller, so on a 50-protocol wallet the old
// version allocated two throwaway arrays + an O(n log n) sort every frame
// for one return value. The pass below is O(n), zero allocations.
export function findActiveProtocolKey({
  stickyLine,
  candidates,
}: {
  stickyLine: number;
  candidates: IStickyProtocolCandidate[];
}): string | undefined {
  if (candidates.length === 0) return undefined;
  let bestTop = Number.NEGATIVE_INFINITY;
  let bestKey: string | undefined;
  for (const c of candidates) {
    if (c.width > 0 && c.top <= stickyLine && c.top > bestTop) {
      bestTop = c.top;
      bestKey = c.key;
    }
  }
  return bestKey;
}

// Decision for the chip-click pin lock: release iff the latest
// pin-tracker candidate has caught up to the click target. Time-based
// releases are unsafe — Chrome scales smooth-scroll duration with
// distance, and a fixed timeout that fires mid-scroll briefly highlights
// the protocol the scroll is crossing (the one immediately above the
// target) before the scroll lands, which the user sees as a flicker
// through the previous protocol and back.
//
// `target` being null means "no lock"; the helper is safe to call
// unconditionally and will return false in that case.
export function shouldReleasePinLock({
  candidate,
  target,
}: {
  candidate: string | null | undefined;
  target: string | null;
}): boolean {
  return target !== null && candidate === target;
}

export function shouldQueueProtocolNavigation({
  hasRegisteredHandle,
  isNative,
  tableLayout,
}: {
  hasRegisteredHandle: boolean;
  isNative: boolean;
  tableLayout: boolean;
}): boolean {
  return !hasRegisteredHandle && !isNative && tableLayout;
}

// Whether the active chip in the protocol-chip strip is wholly inside the
// strip's visible scroll window. Coordinates are passed in whichever frame
// the caller measures in (storage layout vs. live `getBoundingClientRect`)
// — the helper just compares two ranges. The tolerance absorbs sub-pixel
// rounding from CSS layout so we don't trigger a recenter on a hairline clip.
//
// `chipLeft + chipWidth <= scrollLeft + viewportWidth + tolerancePx`
// works for both coordinate styles because it's a relative comparison,
// not an absolute one. The actual scroll, when needed, is delegated to
// `Element.scrollIntoView` so the browser owns centering math + clamping
// + animation rather than us reproducing it (and getting the offset frame
// wrong, which is how the previous off-by-padding bug shipped).
export function isChipFullyVisible({
  chipLeft,
  chipWidth,
  scrollLeft,
  viewportWidth,
  tolerancePx = 1,
}: {
  chipLeft: number;
  chipWidth: number;
  scrollLeft: number;
  viewportWidth: number;
  tolerancePx?: number;
}): boolean {
  return (
    chipLeft >= scrollLeft - tolerancePx &&
    chipLeft + chipWidth <= scrollLeft + viewportWidth + tolerancePx
  );
}

export function getStickySidebarMaxHeight({
  viewportHeight,
  stickyLine,
  bottomGap,
}: {
  viewportHeight: number;
  stickyLine: number;
  bottomGap: number;
}): number {
  return Math.max(0, viewportHeight - stickyLine - bottomGap);
}
