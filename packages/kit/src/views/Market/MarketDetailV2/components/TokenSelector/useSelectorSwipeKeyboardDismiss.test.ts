/** @jest-environment jsdom */

import { createElement } from 'react';
import type { ReactNode } from 'react';

import { renderHook } from '@testing-library/react';

import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { dismissMobileTokenSelectorKeyboard } from './dismissMobileTokenSelectorKeyboard';
import {
  SelectorListMeasurementsContext,
  useSelectorListMeasurements,
  useSelectorSwipeKeyboardDismiss,
} from './useSelectorSwipeKeyboardDismiss';

import type { NativeTouchEvent } from 'react-native';

const mockKeyboardIsVisible = jest.fn(() => true);

jest.mock('react-native', () => ({
  Keyboard: { isVisible: () => mockKeyboardIsVisible() },
}));
jest.mock('@onekeyhq/shared/src/platformEnv', () => ({
  __esModule: true,
  default: { isNativeAndroid: true },
}));
jest.mock('./dismissMobileTokenSelectorKeyboard', () => ({
  dismissMobileTokenSelectorKeyboard: jest.fn(),
}));

function touchEvent(pageX: number, pageY: number, count = 1) {
  const touch: NativeTouchEvent = {
    pageX,
    pageY,
    locationX: pageX,
    locationY: pageY,
    identifier: '0',
    target: '1',
    timestamp: 0,
    changedTouches: [],
    touches: [],
  };
  return {
    nativeEvent: {
      ...touch,
      touches: Array.from({ length: count }, (_, index) => ({
        ...touch,
        identifier: String(index),
      })),
    },
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  platformEnv.isNativeAndroid = true;
  mockKeyboardIsVisible.mockReturnValue(true);
});

it.each([-20, 20])(
  'takes a vertical swipe (%s) without any scroll event and blurs only after gaining the responder',
  (dy) => {
    const { result } = renderHook(
      () => useSelectorSwipeKeyboardDismiss().swipeKeyboardDismissProps,
    );
    expect(
      result.current.onStartShouldSetResponderCapture?.(touchEvent(50, 100)),
    ).toBe(false);
    expect(
      result.current.onMoveShouldSetResponderCapture?.(
        touchEvent(52, 100 + dy),
      ),
    ).toBe(true);
    expect(dismissMobileTokenSelectorKeyboard).not.toHaveBeenCalled();

    result.current.onResponderGrant?.();
    expect(dismissMobileTokenSelectorKeyboard).toHaveBeenCalledTimes(1);
    expect(
      result.current.onMoveShouldSetResponderCapture?.(touchEvent(52, 150)),
    ).toBe(false);
    expect(result.current.onResponderTerminationRequest?.()).toBe(true);
  },
);

it('leaves taps, small movements, and horizontal category swipes to their children', () => {
  const { result } = renderHook(
    () => useSelectorSwipeKeyboardDismiss().swipeKeyboardDismissProps,
  );
  result.current.onStartShouldSetResponderCapture?.(touchEvent(50, 100));
  for (const [x, y] of [
    [50, 100],
    [53, 108],
    [50, 112],
    [90, 115],
  ]) {
    expect(
      result.current.onMoveShouldSetResponderCapture?.(touchEvent(x, y)),
    ).toBe(false);
  }
  expect(dismissMobileTokenSelectorKeyboard).not.toHaveBeenCalled();
});

it('does not take swipes when the keyboard is hidden or closes during a gesture', () => {
  const { result } = renderHook(
    () => useSelectorSwipeKeyboardDismiss().swipeKeyboardDismissProps,
  );
  mockKeyboardIsVisible.mockReturnValue(false);
  result.current.onStartShouldSetResponderCapture?.(touchEvent(50, 100));
  expect(
    result.current.onMoveShouldSetResponderCapture?.(touchEvent(50, 150)),
  ).toBe(false);

  mockKeyboardIsVisible.mockReturnValue(true);
  result.current.onStartShouldSetResponderCapture?.(touchEvent(50, 100));
  mockKeyboardIsVisible.mockReturnValue(false);
  expect(
    result.current.onMoveShouldSetResponderCapture?.(touchEvent(50, 150)),
  ).toBe(false);
  expect(dismissMobileTokenSelectorKeyboard).not.toHaveBeenCalled();
});

it('ignores multi-touch until a new single-finger gesture begins', () => {
  const { result } = renderHook(
    () => useSelectorSwipeKeyboardDismiss().swipeKeyboardDismissProps,
  );
  result.current.onStartShouldSetResponderCapture?.(touchEvent(50, 100, 2));
  expect(
    result.current.onMoveShouldSetResponderCapture?.(touchEvent(50, 150)),
  ).toBe(false);
  result.current.onStartShouldSetResponderCapture?.(touchEvent(50, 100));
  expect(
    result.current.onMoveShouldSetResponderCapture?.(touchEvent(50, 150, 2)),
  ).toBe(false);
  expect(
    result.current.onMoveShouldSetResponderCapture?.(touchEvent(50, 180)),
  ).toBe(false);
  expect(dismissMobileTokenSelectorKeyboard).not.toHaveBeenCalled();
});

it.each([
  'onTouchEnd',
  'onTouchCancel',
  'onResponderRelease',
  'onResponderTerminate',
] as const)(
  'resets on %s so a completed gesture cannot dismiss on a later touch',
  (handler) => {
    const { result } = renderHook(
      () => useSelectorSwipeKeyboardDismiss().swipeKeyboardDismissProps,
    );
    result.current.onStartShouldSetResponderCapture?.(touchEvent(50, 100));
    result.current[handler]?.();
    expect(
      result.current.onMoveShouldSetResponderCapture?.(touchEvent(50, 150)),
    ).toBe(false);
    result.current.onStartShouldSetResponderCapture?.(touchEvent(50, 200));
    expect(
      result.current.onMoveShouldSetResponderCapture?.(touchEvent(50, 220)),
    ).toBe(true);
    result.current.onResponderGrant?.();
    expect(dismissMobileTokenSelectorKeyboard).toHaveBeenCalledTimes(1);
  },
);

it('leaves other platforms without gesture handlers', () => {
  platformEnv.isNativeAndroid = false;
  const { result } = renderHook(
    () => useSelectorSwipeKeyboardDismiss().swipeKeyboardDismissProps,
  );
  expect(result.current).toEqual({});
  expect(mockKeyboardIsVisible).not.toHaveBeenCalled();
  expect(dismissMobileTokenSelectorKeyboard).not.toHaveBeenCalled();
});

function setupMeasuredList(hasList = true) {
  const { result: selector } = renderHook(useSelectorSwipeKeyboardDismiss);
  const list = renderHook(
    ({ enabled }) => useSelectorListMeasurements(enabled),
    {
      initialProps: { enabled: hasList },
      wrapper: ({ children }: { children: ReactNode }) =>
        createElement(
          SelectorListMeasurementsContext.Provider,
          {
            value: selector.current.listMeasurements,
          },
          children,
        ),
    },
  );
  const layout = (height: number) =>
    list.result.current.onLayout?.({
      nativeEvent: { layout: { height, width: 400, x: 0, y: 0 } },
    });
  const swipe = () => {
    selector.current.swipeKeyboardDismissProps.onStartShouldSetResponderCapture?.(
      touchEvent(50, 100),
    );
    return selector.current.swipeKeyboardDismissProps.onMoveShouldSetResponderCapture?.(
      touchEvent(50, 150),
    );
  };
  return { selector, list, layout, swipe };
}

it('preserves the first drag for a scrollable list and captures only once content fits', () => {
  const { list, layout, swipe } = setupMeasuredList();
  // Wait for both dimensions rather than stealing an unmeasured list's drag.
  expect(swipe()).toBe(false);
  layout(400);
  expect(swipe()).toBe(false);
  list.result.current.onContentSizeChange?.(400, 1000);
  expect(swipe()).toBe(false);
  expect(dismissMobileTokenSelectorKeyboard).not.toHaveBeenCalled();
  list.result.current.onContentSizeChange?.(400, 200);
  expect(swipe()).toBe(true);
  // Keyboard resizing can turn the same list into a scrollable one.
  layout(100);
  expect(swipe()).toBe(false);
  layout(200);
  expect(swipe()).toBe(true);
});

it('releases stale measurements when switching to an empty/loading state or unmounting a list', () => {
  const { selector, list, layout, swipe } = setupMeasuredList();
  layout(400);
  list.result.current.onContentSizeChange?.(400, 1000);
  expect(swipe()).toBe(false);
  list.rerender({ enabled: false });
  expect(selector.current.listMeasurements.current.size).toBe(0);
  expect(swipe()).toBe(true);
  list.rerender({ enabled: true });
  expect(swipe()).toBe(false);
  list.unmount();
  expect(selector.current.listMeasurements.current.size).toBe(0);
  expect(swipe()).toBe(true);
});

it('keeps the fallback available for loading and empty states with no list', () => {
  const { list, swipe } = setupMeasuredList(false);
  expect(list.result.current).toEqual({});
  expect(swipe()).toBe(true);
});

it('does not change lists rendered outside the mobile detail selector', () => {
  const { result } = renderHook(() => useSelectorListMeasurements());
  expect(result.current).toEqual({});
});
