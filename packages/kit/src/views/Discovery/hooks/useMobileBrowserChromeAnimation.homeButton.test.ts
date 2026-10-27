/** @jest-environment jsdom */
// The bottom zone has to be at least one frame change wide, or the layout can
// still collapse near the bottom and the last stretch of the page becomes
// unreachable. This runs with home-button iPhone measurements, where the frame
// change (66pt) is larger than the bar (62pt) and a bar-sized zone would leave
// a gap. The main hook test file covers a notched phone, where the bar is wider.
import { act, renderHook } from '@testing-library/react';

import type { IWebViewOnScrollEvent } from '@onekeyhq/kit/src/components/WebView/types';

import useMobileBrowserChromeAnimation from './useMobileBrowserChromeAnimation';

// iPhone SE class: no bottom inset. Mirrors browserChrome.ts.
const BAR_CAPSULE = 46;
const PILL = 30;
const FULL_BAR = 8 + BAR_CAPSULE + 8; // 62
const COLLAPSED_BAR = 8 + PILL + 4; // 42
const FRAME_DELTA = 46 + (FULL_BAR - COLLAPSED_BAR); // 66

jest.mock('../components/MobileBrowser/browserChrome', () => ({
  CHROME_FOLLOWS_SCROLL: true,
  getBarReservedHeight: () => 62,
  getCollapsedReservedHeight: () => 42,
}));
jest.mock('@onekeyhq/components', () => ({
  useSafeAreaInsets: () => ({ top: 20, bottom: 0 }),
}));
jest.mock('react-native-reanimated', () => ({
  __esModule: true,
  Easing: { inOut: () => (t: number) => t, ease: (t: number) => t },
  useSharedValue: (initial: number) => ({ value: initial }),
  withSpring: (t: number, _c?: unknown, cb?: (d: boolean) => void) => {
    cb?.(true);
    return t;
  },
  withTiming: (t: number, _c?: unknown, cb?: (d: boolean) => void) => {
    cb?.(true);
    return t;
  },
  useAnimatedStyle: (f: () => unknown) => f(),
}));

const CONTENT = 3000;
const SCREEN = 800;
const COLLAPSED_VIEWPORT = SCREEN - COLLAPSED_BAR; // 758
const EXPANDED_VIEWPORT = SCREEN - (46 + FULL_BAR); // 692
const MAX_SCROLL_COLLAPSED = CONTENT - COLLAPSED_VIEWPORT; // 2242
const MAX_SCROLL_EXPANDED = CONTENT - EXPANDED_VIEWPORT; // 2308

function ev(y: number, interacting: boolean, viewport: number) {
  return {
    nativeEvent: {
      contentOffset: { y, x: 0 },
      contentSize: { height: CONTENT, width: 400 },
      contentInset: { top: 0, bottom: 0, left: 0, right: 0 },
      layoutMeasurement: { height: viewport, width: 400 },
      isInteracting: interacting,
    },
  } as unknown as IWebViewOnScrollEvent;
}

it('the frame change is larger than the bar on a home-button iPhone', () => {
  expect(FRAME_DELTA).toBe(66);
  expect(FULL_BAR).toBe(62);
  expect(FRAME_DELTA).toBeGreaterThan(FULL_BAR);
});

it('keeps the last stretch reachable where the frame change exceeds the bar', () => {
  const { result } = renderHook(() => useMobileBrowserChromeAnimation());
  const { handleScroll, chromeProgress, layoutExpanded } = result.current;

  act(() => {
    handleScroll(ev(100, true, EXPANDED_VIEWPORT));
    handleScroll(ev(200, true, EXPANDED_VIEWPORT));
    handleScroll(ev(300, true, COLLAPSED_VIEWPORT));
  });
  expect(chromeProgress.value).toBe(0);
  expect(layoutExpanded.value).toBe(0);

  // Bottom of the collapsed frame: the chrome expands, the frame shrinks by
  // 66pt, so the offset now sits exactly one frame change above the new bottom.
  act(() => {
    handleScroll(ev(MAX_SCROLL_COLLAPSED, true, COLLAPSED_VIEWPORT));
    handleScroll(ev(MAX_SCROLL_COLLAPSED, false, COLLAPSED_VIEWPORT));
  });
  expect(chromeProgress.value).toBe(1);
  expect(layoutExpanded.value).toBe(1);
  expect(MAX_SCROLL_EXPANDED - MAX_SCROLL_COLLAPSED).toBe(FRAME_DELTA);

  // This is the window a bar-sized zone would miss: the offset is one frame
  // change from the bottom, which is more than the 62pt bar. Dragging down must
  // not collapse the layout, or the frame grows back and the offset overshoots.
  for (const step of [2, 4, 6]) {
    act(() => {
      handleScroll(ev(MAX_SCROLL_COLLAPSED + step, true, EXPANDED_VIEWPORT));
    });
    expect(layoutExpanded.value).toBe(1);
  }

  // The offset can still travel all the way to the expanded bottom.
  act(() => {
    handleScroll(ev(MAX_SCROLL_EXPANDED, true, EXPANDED_VIEWPORT));
  });
  expect(chromeProgress.value).toBe(1);
  expect(layoutExpanded.value).toBe(1);
});
