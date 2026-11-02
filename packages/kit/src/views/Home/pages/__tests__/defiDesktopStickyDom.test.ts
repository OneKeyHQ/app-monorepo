import {
  findActiveProtocolKey,
  findOverflowAncestorFromLocalNode,
  findScrollableAncestorFromLocalNode,
  isChipFullyVisible,
  isProtocolVisible,
  shouldQueueProtocolNavigation,
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

  it('finds the overflow container before its content overflows', () => {
    const scroller = createFakeElement({
      overflowY: 'auto',
      scrollHeight: 200,
      clientHeight: 200,
    });
    const wrapper = createFakeElement({
      parent: scroller,
      overflowY: 'hidden',
      scrollHeight: 500,
      clientHeight: 200,
    });
    const localNode = createFakeElement({ parent: wrapper });

    expect(findOverflowAncestorFromLocalNode(localNode)).toBe(scroller);
    expect(findScrollableAncestorFromLocalNode(localNode)).toBeNull();
  });

  it('returns null when no ancestor owns vertical scrolling', () => {
    const root = createFakeElement({ overflowY: 'hidden' });
    const localNode = createFakeElement({
      parent: createFakeElement({ parent: root }),
    });

    expect(findOverflowAncestorFromLocalNode(localNode)).toBeNull();
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

    it('advances through multiple unreachable tail cards in both directions', () => {
      const getActive = (scrollTop: number) =>
        findActiveProtocolKey({
          stickyLine: 215,
          scrollMetrics: { scrollTop, maxScroll: 4620, viewportBottom: 1240 },
          // Deliberately not in visual order: registration can be asynchronous.
          candidates: [
            {
              key: 'last',
              top: 4990 + 215 - scrollTop,
              bottom: 4990 + 445 - scrollTop,
              width: 100,
            },
            {
              key: 'first',
              top: 4300 + 215 - scrollTop,
              bottom: 4300 + 615 - scrollTop,
              width: 100,
            },
            {
              key: 'middle',
              top: 4735 + 215 - scrollTop,
              bottom: 4735 + 450 - scrollTop,
              width: 100,
            },
          ],
        });

      expect([4300, 4410, 4520, 4619.5, 4410, 4300].map(getActive)).toEqual([
        'first',
        'middle',
        'last',
        'last',
        'middle',
        'first',
      ]);
    });

    it('advances through visible cards when none can reach the sticky line', () => {
      const getActive = (scrollTop: number) =>
        findActiveProtocolKey({
          stickyLine: 100,
          scrollMetrics: { scrollTop, maxScroll: 1000, viewportBottom: 800 },
          candidates: [1100, 1200, 1300].map((trigger, index) => ({
            key: ['first', 'middle', 'last'][index],
            top: trigger + 100 - scrollTop,
            bottom: trigger + 180 - scrollTop,
            width: 100,
          })),
        });

      expect([400, 401, 610, 810, 1000, 610, 401].map(getActive)).toEqual([
        undefined,
        'first',
        'middle',
        'last',
        'last',
        'middle',
        'first',
      ]);
    });

    it('keeps the visible card when an unreachable last card is below the viewport', () => {
      expect(
        findActiveProtocolKey({
          stickyLine: 100,
          scrollMetrics: {
            scrollTop: 1000,
            maxScroll: 1000,
            viewportBottom: 800,
          },
          candidates: [
            { key: 'visible', top: 200, bottom: 280, width: 100 },
            { key: 'below', top: 900, bottom: 980, width: 100 },
          ],
        }),
      ).toBe('visible');
    });

    it('does not activate an off-screen or hidden tail card', () => {
      expect(
        findActiveProtocolKey({
          stickyLine: 100,
          scrollMetrics: {
            scrollTop: 1000,
            maxScroll: 1000,
            viewportBottom: 500,
          },
          candidates: [
            { key: 'visible', top: 90, bottom: 250, width: 100 },
            { key: 'hidden', top: 120, bottom: 200, width: 0 },
            { key: 'below', top: 600, bottom: 700, width: 100 },
          ],
        }),
      ).toBe('visible');
    });

    it('does not use the tail rule when the page cannot scroll', () => {
      expect(
        findActiveProtocolKey({
          stickyLine: 100,
          scrollMetrics: { scrollTop: 0, maxScroll: 0, viewportBottom: 500 },
          candidates: [
            { key: 'first', top: 90, bottom: 200, width: 100 },
            { key: 'last', top: 150, bottom: 200, width: 100 },
          ],
        }),
      ).toBe('first');
    });
  });

  it('treats a rearranged protocol as invisible outside the unobscured viewport', () => {
    const candidate = { key: 'selected', top: 500, bottom: 600, width: 100 };
    const viewport = { stickyLine: 100, viewportBottom: 800 };
    expect(isProtocolVisible({ ...candidate, ...viewport })).toBe(true);
    expect(isProtocolVisible({ ...candidate, ...viewport, top: 800 })).toBe(
      false,
    );
    expect(isProtocolVisible({ ...candidate, ...viewport, bottom: 100 })).toBe(
      false,
    );
    expect(isProtocolVisible({ ...candidate, ...viewport, width: 0 })).toBe(
      false,
    );
  });

  describe('shouldQueueProtocolNavigation', () => {
    it('queues only missing desktop table-layout protocol handles', () => {
      expect(
        shouldQueueProtocolNavigation({
          hasRegisteredHandle: false,
          isNative: false,
          tableLayout: true,
        }),
      ).toBe(true);

      expect(
        shouldQueueProtocolNavigation({
          hasRegisteredHandle: true,
          isNative: false,
          tableLayout: true,
        }),
      ).toBe(false);

      expect(
        shouldQueueProtocolNavigation({
          hasRegisteredHandle: false,
          isNative: true,
          tableLayout: true,
        }),
      ).toBe(false);

      expect(
        shouldQueueProtocolNavigation({
          hasRegisteredHandle: false,
          isNative: false,
          tableLayout: false,
        }),
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
