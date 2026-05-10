import {
  findActiveProtocolKey,
  findScrollableAncestorFromLocalNode,
  getStickySidebarMaxHeight,
  isChipFullyVisible,
  shouldReleasePinLock,
} from '../defiDesktopStickyDom';

type IFakeElement = HTMLElement & {
  __overflowY?: string;
};

function createFakeElement(params?: {
  parent?: HTMLElement | null;
  overflowY?: string;
  scrollHeight?: number;
  clientHeight?: number;
}): HTMLElement {
  const el = {
    parentElement: params?.parent ?? null,
    scrollHeight: params?.scrollHeight ?? 0,
    clientHeight: params?.clientHeight ?? 0,
    __overflowY: params?.overflowY,
  } as IFakeElement;

  return el;
}

describe('defiDesktopStickyDom', () => {
  const originalGetComputedStyle = globalThis.getComputedStyle;

  beforeEach(() => {
    Object.defineProperty(globalThis, 'getComputedStyle', {
      configurable: true,
      value: jest.fn((node: HTMLElement) => ({
        overflowY: (node as IFakeElement).__overflowY ?? 'visible',
      })),
    });
  });

  afterAll(() => {
    Object.defineProperty(globalThis, 'getComputedStyle', {
      configurable: true,
      value: originalGetComputedStyle,
    });
  });

  it('finds the first scrollable ancestor from a local node', () => {
    const scrollableAncestor = createFakeElement({
      overflowY: 'auto',
      scrollHeight: 400,
      clientHeight: 200,
    });
    const nonScrollableParent = createFakeElement({
      parent: scrollableAncestor,
      overflowY: 'auto',
      scrollHeight: 200,
      clientHeight: 200,
    });
    const localNode = createFakeElement({ parent: nonScrollableParent });

    expect(findScrollableAncestorFromLocalNode(localNode)).toBe(
      scrollableAncestor,
    );
  });

  it('returns null when no ancestor satisfies the scrollable rule', () => {
    const root = createFakeElement({
      overflowY: 'scroll',
      scrollHeight: 200,
      clientHeight: 200,
    });
    const parent = createFakeElement({
      parent: root,
      overflowY: 'hidden',
      scrollHeight: 500,
      clientHeight: 200,
    });
    const localNode = createFakeElement({ parent });

    expect(findScrollableAncestorFromLocalNode(localNode)).toBeNull();
  });

  it('computes sticky sidebar max height from viewport height, sticky line, and bottom gap', () => {
    expect(
      getStickySidebarMaxHeight({
        viewportHeight: 900,
        stickyLine: 140,
        bottomGap: 24,
      }),
    ).toBe(736);
  });

  it('clamps sticky sidebar max height at zero', () => {
    expect(
      getStickySidebarMaxHeight({
        viewportHeight: 120,
        stickyLine: 100,
        bottomGap: 40,
      }),
    ).toBe(0);
  });

  describe('findActiveProtocolKey', () => {
    it('returns the largest top that is still at or below the sticky line', () => {
      // Picks "winner" because its top (90) is closest to stickyLine (100)
      // among candidates whose top <= 100.
      expect(
        findActiveProtocolKey({
          stickyLine: 100,
          candidates: [
            { key: 'too-high', top: 20, bottom: 60, width: 120 },
            { key: 'winner', top: 90, bottom: 200, width: 120 },
            { key: 'below-line', top: 110, bottom: 300, width: 120 },
          ],
        }),
      ).toBe('winner');
    });

    it('treats top == stickyLine as crossed (boundary inclusion)', () => {
      // The chip click handler scrolls a protocol so its top lands exactly
      // at the sticky line. That protocol must qualify or the active chip
      // would not match the user's click.
      expect(
        findActiveProtocolKey({
          stickyLine: 100,
          candidates: [
            { key: 'on-the-line', top: 100, bottom: 300, width: 120 },
          ],
        }),
      ).toBe('on-the-line');
    });

    it('keeps the last crossed protocol active across an inter-protocol gap', () => {
      // Between two protocols, neither has a body intersecting the sticky
      // line — active stays on the most-recently-crossed.
      expect(
        findActiveProtocolKey({
          stickyLine: 100,
          candidates: [
            { key: 'previous', top: -50, bottom: 80, width: 120 },
            { key: 'next', top: 150, bottom: 400, width: 120 },
          ],
        }),
      ).toBe('previous');
    });

    it('keeps the last protocol active after the user scrolls past its bottom edge', () => {
      // Last protocol's bottom is above sticky line — already scrolled
      // past. Active still holds steady on it (user "most recently
      // visited" it).
      expect(
        findActiveProtocolKey({
          stickyLine: 100,
          candidates: [
            { key: 'first', top: -800, bottom: -500, width: 120 },
            { key: 'last', top: -400, bottom: -50, width: 120 },
          ],
        }),
      ).toBe('last');
    });

    it('returns undefined when no protocol has crossed the sticky line', () => {
      expect(
        findActiveProtocolKey({
          stickyLine: 100,
          candidates: [
            { key: 'far-below', top: 200, bottom: 500, width: 120 },
            { key: 'also-below', top: 350, bottom: 700, width: 120 },
          ],
        }),
      ).toBeUndefined();
    });

    it('skips zero-width candidates', () => {
      // A protocol whose card has zero rendered width (display:none, not
      // yet measured) is not considered an active candidate even if its
      // recorded top would otherwise win.
      expect(
        findActiveProtocolKey({
          stickyLine: 100,
          candidates: [
            { key: 'visible', top: 50, bottom: 200, width: 120 },
            { key: 'phantom', top: 95, bottom: 200, width: 0 },
          ],
        }),
      ).toBe('visible');
    });
  });

  describe('shouldReleasePinLock', () => {
    it('releases when the pin candidate has caught up to the click target', () => {
      // Smooth scroll has landed: the pin tracker's natural read agrees
      // with what the chip click asked for. Safe to lift the lock.
      expect(
        shouldReleasePinLock({ candidate: 'target', target: 'target' }),
      ).toBe(true);
    });

    it('keeps the lock while the scroll is still mid-flight on a previous protocol', () => {
      // The previous bug: a fixed-time release would lift the lock here
      // and let the strip flicker to "previous" before the scroll lands
      // on "target". Condition-based release waits for the match.
      expect(
        shouldReleasePinLock({ candidate: 'previous', target: 'target' }),
      ).toBe(false);
    });

    it('keeps the lock while the pin tracker has no candidate yet', () => {
      // Scroll has moved past the last protocol or the tab is unfocused;
      // the lock is held until either the candidate appears as the
      // target or the safety timer in the caller fires.
      expect(shouldReleasePinLock({ candidate: null, target: 'target' })).toBe(
        false,
      );
    });

    it('returns false when no lock is in effect (target null)', () => {
      // The caller can invoke this unconditionally; a null target is the
      // "no lock" sentinel and must never trigger a release.
      expect(
        shouldReleasePinLock({ candidate: 'anything', target: null }),
      ).toBe(false);
    });
  });

  describe('isChipFullyVisible', () => {
    it('treats a chip wholly inside the visible window as visible', () => {
      expect(
        isChipFullyVisible({
          chipLeft: 50,
          chipWidth: 100,
          scrollLeft: 0,
          viewportWidth: 200,
        }),
      ).toBe(true);
    });

    it('treats a chip clipped on the right edge as not visible', () => {
      // chipRight = 250, viewport ends at 200 → clipped → recenter needed.
      expect(
        isChipFullyVisible({
          chipLeft: 150,
          chipWidth: 100,
          scrollLeft: 0,
          viewportWidth: 200,
        }),
      ).toBe(false);
    });

    it('treats a chip clipped on the left edge as not visible', () => {
      // chipLeft is to the left of scrollLeft → clipped on the left.
      expect(
        isChipFullyVisible({
          chipLeft: 50,
          chipWidth: 100,
          scrollLeft: 80,
          viewportWidth: 200,
        }),
      ).toBe(false);
    });

    it('absorbs sub-pixel layout noise via the tolerance', () => {
      // Chip ends at 200.4, viewport ends at 200 — within 1px tolerance,
      // so still counted visible. Without tolerance, this would trigger
      // a needless recenter on every layout pass.
      expect(
        isChipFullyVisible({
          chipLeft: 100,
          chipWidth: 100.4,
          scrollLeft: 0,
          viewportWidth: 200,
        }),
      ).toBe(true);
    });
  });

  describe('isChipFullyVisible (viewport-rect mode)', () => {
    // The strip's recenter measures live via `getBoundingClientRect`, so it
    // passes viewport-relative left/width pairs for both chip and viewport.
    // The helper handles either coord style; these cases lock that in.
    it('treats a chip wholly inside the viewport rect as visible', () => {
      expect(
        isChipFullyVisible({
          chipLeft: 220,
          chipWidth: 80,
          scrollLeft: 200,
          viewportWidth: 400,
        }),
      ).toBe(true);
    });

    it('catches a chip whose viewport-right exceeds the strip', () => {
      // chipRight = 620, strip right edge = 600 → off-screen on the right.
      expect(
        isChipFullyVisible({
          chipLeft: 540,
          chipWidth: 80,
          scrollLeft: 200,
          viewportWidth: 400,
        }),
      ).toBe(false);
    });
  });
});
