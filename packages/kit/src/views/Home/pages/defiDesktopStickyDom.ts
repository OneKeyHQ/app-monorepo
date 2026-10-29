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

// Nearest ancestor that owns vertical scrolling, whether or not its content
// overflows yet. `findScrollableAncestorFromLocalNode` needs an element that
// already scrolls (it positions anchors inside one); a sidebar that caps
// itself to the scroller's height has to find the container on a short
// first frame too, before async lists grow the page past the viewport.
export function findOverflowAncestorFromLocalNode(
  node: HTMLElement,
): HTMLElement | null {
  let current: HTMLElement | null = node.parentElement;

  while (current) {
    const { overflowY } = globalThis.getComputedStyle(current);
    if (overflowY === 'auto' || overflowY === 'scroll') {
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

// Select the latest card crossing the sticky line, including short tail
// cards that cannot scroll far enough to reach it.
export function findActiveProtocolKey({
  stickyLine,
  candidates,
  scrollMetrics,
}: {
  stickyLine: number;
  candidates: IStickyProtocolCandidate[];
  scrollMetrics?: {
    scrollTop: number;
    maxScroll: number;
    viewportBottom: number;
  };
}): string | undefined {
  if (candidates.length === 0) return undefined;
  if (scrollMetrics && scrollMetrics.maxScroll > 1) {
    const { scrollTop, maxScroll, viewportBottom } = scrollMetrics;
    let hasUnreachable = false;
    let firstTop = Number.POSITIVE_INFINITY;
    let lastReachableTop = Number.NEGATIVE_INFINITY;
    for (const item of candidates) {
      if (item.width > 0) {
        firstTop = Math.min(firstTop, item.top);
        if (scrollTop + item.top - stickyLine > maxScroll + 1) {
          hasUnreachable = true;
        } else {
          lastReachableTop = Math.max(lastReachableTop, item.top);
        }
      }
    }
    if (hasUnreachable) {
      const hasReachable = Number.isFinite(lastReachableTop);
      // If no card can reach the line, begin when the first card enters the
      // viewport rather than clamping its unreachable line position to the end.
      const anchorTop = hasReachable ? lastReachableTop : firstTop;
      const anchorLine = hasReachable ? stickyLine : viewportBottom;
      const start = Math.max(
        0,
        Math.min(maxScroll, scrollTop + anchorTop - anchorLine),
      );
      if (scrollTop >= start - 1) {
        const ordered = candidates
          .filter((item) => item.width > 0)
          .toSorted((a, b) => a.top - b.top);
        const firstUnreachable = ordered.findIndex(
          (item) => scrollTop + item.top - stickyLine > maxScroll + 1,
        );
        const anchorIndex = Math.max(0, firstUnreachable - 1);
        // Distribute the remaining scroll across cards that cannot reach the
        // sticky line, while never selecting a card outside the visible area.
        const count = ordered.length - anchorIndex;
        const span = maxScroll - start;
        let progress = 0;
        if (maxScroll - scrollTop <= 1) {
          progress = 1;
        } else if (span > 1) {
          progress = Math.max(0, Math.min(1, (scrollTop - start) / span));
        }
        const targetIndex =
          anchorIndex + Math.min(Math.floor(progress * count), count - 1);
        for (let i = targetIndex; i >= anchorIndex; i -= 1) {
          const item = ordered[i];
          if (item.top < viewportBottom && item.bottom > stickyLine) {
            return item.key;
          }
        }
      }
    }
  }
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
