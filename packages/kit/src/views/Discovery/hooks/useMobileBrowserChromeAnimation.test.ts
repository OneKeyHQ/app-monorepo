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
// where the next event starts from.
jest.mock('react-native-reanimated', () => ({
  __esModule: true,
  Easing: { inOut: () => (t: number) => t, ease: (t: number) => t },
  useSharedValue: (initial: number) => ({ value: initial }),
  withSpring: (target: number) => target,
  withTiming: (target: number) => target,
  useAnimatedStyle: (factory: () => unknown) => factory(),
}));

const CONTENT_HEIGHT = 3000;
const VIEWPORT_HEIGHT = 800;
// contentSize.height - layoutMeasurement.height, with no contentInset.
const MAX_SCROLL_Y = CONTENT_HEIGHT - VIEWPORT_HEIGHT;
// BROWSER_HEADER_HEIGHT (46) plus the 47pt top inset mocked above.
const FOLLOW_DISTANCE = 93;

function scrollEvent(
  y: number,
  isInteracting: boolean | undefined,
  contentSizeHeight = CONTENT_HEIGHT,
) {
  // The hook reads only these fields; the rest of the synthetic event is not
  // built here.
  return {
    nativeEvent: {
      contentOffset: { y, x: 0 },
      contentSize: { height: contentSizeHeight, width: 400 },
      contentInset: { top: 0, bottom: 0, left: 0, right: 0 },
      layoutMeasurement: { height: VIEWPORT_HEIGHT, width: 400 },
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
      handleScroll(scrollEvent(MAX_SCROLL_Y, true));
    });

    expect(chromeProgress.value).toBe(1);
  });
});
