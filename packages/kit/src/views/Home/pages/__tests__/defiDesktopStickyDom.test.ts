import {
  findPinnedProtocolKey,
  findScrollableAncestorFromLocalNode,
  getStickySidebarMaxHeight,
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

  it('finds the pinned protocol key closest to the sticky line from below', () => {
    expect(
      findPinnedProtocolKey({
        stickyLine: 100,
        candidates: [
          { key: 'too-high', top: 20, bottom: 120, width: 120 },
          { key: 'winner', top: 90, bottom: 140, width: 120 },
          { key: 'below-line', top: 110, bottom: 180, width: 120 },
          { key: 'zero-width', top: 95, bottom: 140, width: 0 },
          { key: 'not-crossing', top: 80, bottom: 100, width: 120 },
        ],
      }),
    ).toBe('winner');
  });

  it('returns undefined when no pinned protocol candidate crosses the sticky line', () => {
    expect(
      findPinnedProtocolKey({
        stickyLine: 100,
        candidates: [
          { key: 'below', top: 100, bottom: 160, width: 120 },
          { key: 'ended', top: 10, bottom: 90, width: 120 },
          { key: 'hidden', top: 80, bottom: 120, width: 0 },
        ],
      }),
    ).toBeUndefined();
  });

  it('does not pin a protocol that cannot fit the pinned header before its bottom edge', () => {
    expect(
      findPinnedProtocolKey({
        stickyLine: 100,
        pinnedHeaderHeight: 64,
        candidates: [
          { key: 'too-short', top: 80, bottom: 150, width: 120 },
          { key: 'winner', top: 60, bottom: 190, width: 120 },
        ],
      }),
    ).toBe('winner');
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
});
