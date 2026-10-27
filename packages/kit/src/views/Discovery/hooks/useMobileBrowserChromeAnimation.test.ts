/** @jest-environment jsdom */
import { act, renderHook } from '@testing-library/react';

import type { IWebViewOnScrollEvent } from '@onekeyhq/kit/src/components/WebView/types';

import useMobileBrowserChromeAnimation from './useMobileBrowserChromeAnimation';

// Follows the finger, like on iPhone, where these tests apply.
jest.mock('../components/MobileBrowser/browserChrome', () => ({
  CHROME_FOLLOWS_SCROLL: true,
  getBarReservedHeight: () => 100,
  getCollapsedReservedHeight: () => 60,
}));

jest.mock('@onekeyhq/components', () => ({
  useSafeAreaInsets: () => ({ top: 47, bottom: 34 }),
}));

// A shared value is a plain box here, so a test can put it mid-animation; the
// animations resolve to their target, and the hook's own state is what decides
// where the next event starts from. The end callbacks run, so the layout side
// effects (layoutExpanded) happen as they do on device.
jest.mock('react-native-reanimated', () => ({
  __esModule: true,
  Easing: { inOut: () => (t: number) => t, ease: (t: number) => t },
  useSharedValue: (initial: number) => ({ value: initial }),
  withSpring: (
    target: number,
    _cfg?: unknown,
    cb?: (done: boolean) => void,
  ) => {
    cb?.(true);
    return target;
  },
  withTiming: (
    target: number,
    _cfg?: unknown,
    cb?: (done: boolean) => void,
  ) => {
    cb?.(true);
    return target;
  },
  useAnimatedStyle: (factory: () => unknown) => factory(),
}));

const CONTENT_HEIGHT = 3000;
// Screen 800pt. The frame is this minus the chrome: expanded it loses the header
// spacer (46) and the full bar (100); collapsed it only loses the collapsed pill
// strip (60), so the collapsed frame is taller by 86pt. That delta is what the
// hook's layoutHeightDelta works out to, and why the frame moves when it flips.
const SCREEN_HEIGHT = 800;
const COLLAPSED_VIEWPORT_HEIGHT = SCREEN_HEIGHT - 60; // 740
const EXPANDED_VIEWPORT_HEIGHT = SCREEN_HEIGHT - (46 + 100); // 654
// contentSize - the largest (collapsed) frame: the offset at the real bottom.
const MAX_SCROLL_Y = CONTENT_HEIGHT - COLLAPSED_VIEWPORT_HEIGHT;
// BROWSER_HEADER_HEIGHT (46) plus the 47pt top inset mocked above.
const FOLLOW_DISTANCE = 93;

function scrollEvent(
  y: number,
  isInteracting: boolean | undefined,
  viewportHeight = EXPANDED_VIEWPORT_HEIGHT,
  contentSizeHeight = CONTENT_HEIGHT,
): IWebViewOnScrollEvent {
  // The hook reads only these fields; the rest of the synthetic event is not
  // built here.
  return {
    nativeEvent: {
      contentOffset: { y, x: 0 },
      contentSize: { height: contentSizeHeight, width: 400 },
      contentInset: { top: 0, bottom: 0, left: 0, right: 0 },
      layoutMeasurement: { height: viewportHeight, width: 400 },
      isInteracting,
    },
  } as unknown as IWebViewOnScrollEvent;
}

function renderChrome() {
  return renderHook(() => useMobileBrowserChromeAnimation());
}

// Scrolls far enough down to collapse the chrome, then releases the finger so it
// settles towards the collapsed state.
function collapseAndSettle(
  handleScroll: (event: IWebViewOnScrollEvent) => void,
  chromeProgress: { value: number },
) {
  act(() => {
    handleScroll(scrollEvent(300, true));
    handleScroll(scrollEvent(400, true));
  });
  expect(chromeProgress.value).toBe(0);

  act(() => {
    handleScroll(scrollEvent(400, false));
  });
  expect(chromeProgress.value).toBe(0);
}

describe('useMobileBrowserChromeAnimation finger tracking', () => {
  it('resumes from the drawn progress when a drag starts during a settle', () => {
    const { result } = renderChrome();
    const { handleScroll, chromeProgress } = result.current;

    collapseAndSettle(handleScroll, chromeProgress);

    // The 250ms settle is still running: its target is 0, but the chrome is
    // drawn at 0.6. Starting a drag here must continue from 0.6, or the header
    // and bar jump to whatever the target plus one delta works out to.
    chromeProgress.value = 0.6;

    act(() => {
      handleScroll(scrollEvent(400 - 20, true));
    });

    expect(chromeProgress.value).toBeCloseTo(0.6 + 20 / FOLLOW_DISTANCE, 4);
    expect(chromeProgress.value).toBeGreaterThan(0.7);
  });

  it('keeps following from the target once a gesture is under way', () => {
    const { result } = renderChrome();
    const { handleScroll, chromeProgress } = result.current;

    act(() => {
      handleScroll(scrollEvent(300, true));
      // A short drag, so the progress stays between the two states instead of
      // clamping to an endpoint where both sources would agree.
      handleScroll(scrollEvent(310, true));
    });
    const afterFirstDrag = chromeProgress.value;
    expect(afterFirstDrag).toBeCloseTo(1 - 10 / FOLLOW_DISTANCE, 4);

    // A second event of the same gesture must not pay for another synchronous
    // read of the shared value: it continues from the target the first one
    // wrote, not from wherever the value happens to be drawn.
    chromeProgress.value = 0.05;
    act(() => {
      handleScroll(scrollEvent(320, true));
    });

    expect(chromeProgress.value).toBeCloseTo(
      afterFirstDrag - 10 / FOLLOW_DISTANCE,
      4,
    );
  });

  it('settles to the nearer state when the finger lifts', () => {
    const { result } = renderChrome();
    const { handleScroll, chromeProgress } = result.current;

    act(() => {
      handleScroll(scrollEvent(300, true));
      // A small drag: the chrome is still well past the crossfade point.
      handleScroll(scrollEvent(310, true));
    });
    expect(chromeProgress.value).toBeCloseTo(1 - 10 / FOLLOW_DISTANCE, 4);

    act(() => {
      handleScroll(scrollEvent(310, false));
    });

    expect(chromeProgress.value).toBe(1);
  });

  it('expands fully at the bottom of the page', () => {
    const { result } = renderChrome();
    const { handleScroll, chromeProgress } = result.current;

    act(() => {
      handleScroll(scrollEvent(300, true));
      handleScroll(scrollEvent(400, true));
    });
    expect(chromeProgress.value).toBe(0);

    act(() => {
      // At the bottom of the collapsed frame, which is what the finger reaches.
      handleScroll(scrollEvent(MAX_SCROLL_Y, true, COLLAPSED_VIEWPORT_HEIGHT));
    });

    expect(chromeProgress.value).toBe(1);
  });

  it('keeps the frame from shrinking above the page bottom', () => {
    const { result } = renderChrome();
    const { handleScroll, chromeProgress, layoutExpanded } = result.current;

    // Reach the bottom of the collapsed frame, then release: the chrome settles
    // expanded and the frame shrinks by the layout delta, leaving a further
    // stretch of the page below the offset.
    act(() => {
      handleScroll(scrollEvent(300, true));
      handleScroll(scrollEvent(400, true));
      handleScroll(scrollEvent(MAX_SCROLL_Y, true, COLLAPSED_VIEWPORT_HEIGHT));
      handleScroll(scrollEvent(MAX_SCROLL_Y, false, COLLAPSED_VIEWPORT_HEIGHT));
    });
    expect(chromeProgress.value).toBe(1);
    expect(layoutExpanded.value).toBe(1);

    const expandedMaxScrollY = CONTENT_HEIGHT - EXPANDED_VIEWPORT_HEIGHT;
    expect(expandedMaxScrollY).toBeGreaterThan(MAX_SCROLL_Y);

    // Dragging down from here is what used to loop: collapsing the layout made
    // the frame grow again, so the offset turned into an overscroll and sprang
    // back, and the remaining stretch stayed unreachable. The frame must stay as
    // it is, which keeps the offset legal and lets it travel on.
    act(() => {
      handleScroll(
        scrollEvent(MAX_SCROLL_Y + 10, true, EXPANDED_VIEWPORT_HEIGHT),
      );
    });
    expect(layoutExpanded.value).toBe(1);

    act(() => {
      handleScroll(
        scrollEvent(expandedMaxScrollY, true, EXPANDED_VIEWPORT_HEIGHT),
      );
    });
    expect(chromeProgress.value).toBe(1);
    expect(layoutExpanded.value).toBe(1);
  });

  it('does not collapse the layout while the chrome sits at the bottom', () => {
    const { result } = renderChrome();
    const { handleScroll, chromeProgress, layoutExpanded } = result.current;

    // Collapse mid-page first, so the layout has somewhere to collapse from.
    act(() => {
      handleScroll(scrollEvent(300, true));
      handleScroll(scrollEvent(400, true));
    });
    expect(layoutExpanded.value).toBe(0);

    // Arriving in the bottom zone eases the chrome open without collapsing the
    // layout any further: the frame is the taller collapsed one here, so there
    // is room to ease in with the distance left rather than snap to 1.
    act(() => {
      handleScroll(
        scrollEvent(MAX_SCROLL_Y - 4, true, COLLAPSED_VIEWPORT_HEIGHT),
      );
    });
    expect(chromeProgress.value).toBeGreaterThan(0.9);
    expect(chromeProgress.value).toBeLessThanOrEqual(1);

    act(() => {
      handleScroll(
        scrollEvent(MAX_SCROLL_Y - 2, true, COLLAPSED_VIEWPORT_HEIGHT),
      );
    });
    expect(chromeProgress.value).toBeGreaterThan(0.9);
    expect(layoutExpanded.value).toBe(0);
  });

  it('eases into the bottom zone instead of snapping from collapsed', () => {
    const { result } = renderChrome();
    const { handleScroll, chromeProgress, layoutExpanded } = result.current;

    // Collapse mid-page.
    act(() => {
      handleScroll(scrollEvent(300, true));
      handleScroll(scrollEvent(400, true));
    });
    expect(chromeProgress.value).toBe(0);

    // One step across the bottom-zone boundary. The chrome must not jump to 1:
    // a 0 -> 1 change also shifts the page by the header height under the
    // user's finger. With the collapsed frame the chrome eases in with the
    // distance left instead.
    const bottomZone = 88; // fullBarHeight in this test's mock
    act(() => {
      handleScroll(
        scrollEvent(
          MAX_SCROLL_Y - bottomZone - 6,
          true,
          COLLAPSED_VIEWPORT_HEIGHT,
        ),
      );
    });
    const outsideZone = chromeProgress.value;

    act(() => {
      handleScroll(
        scrollEvent(
          MAX_SCROLL_Y - bottomZone + 40,
          true,
          COLLAPSED_VIEWPORT_HEIGHT,
        ),
      );
    });

    // The exact value follows the distance left, and the finger's own delta
    // only ever raises it, so it stays strictly between collapsed and expanded.
    expect(chromeProgress.value).toBeLessThan(1);
    expect(chromeProgress.value).toBeGreaterThan(0.4);
    // Crossing the boundary is not a full flip in one event.
    expect(chromeProgress.value - outsideZone).toBeLessThan(0.95);
    expect(layoutExpanded.value).toBe(0);
  });
});
