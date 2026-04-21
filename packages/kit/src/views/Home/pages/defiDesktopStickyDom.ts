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

export function findPinnedProtocolKey({
  stickyLine,
  candidates,
}: {
  stickyLine: number;
  candidates: IStickyProtocolCandidate[];
}): string | undefined {
  return candidates
    .filter(
      (candidate) =>
        candidate.top < stickyLine &&
        candidate.bottom > stickyLine &&
        candidate.width > 0,
    )
    .sort((a, b) => b.top - a.top)[0]?.key;
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
