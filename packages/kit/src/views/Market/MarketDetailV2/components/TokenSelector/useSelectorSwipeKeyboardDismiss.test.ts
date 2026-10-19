/** @jest-environment jsdom */

import { renderHook } from '@testing-library/react';

import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { dismissMobileTokenSelectorKeyboard } from './dismissMobileTokenSelectorKeyboard';
import { useSelectorSwipeKeyboardDismiss } from './useSelectorSwipeKeyboardDismiss';

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
    const { result } = renderHook(useSelectorSwipeKeyboardDismiss);
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
  const { result } = renderHook(useSelectorSwipeKeyboardDismiss);
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
  const { result } = renderHook(useSelectorSwipeKeyboardDismiss);
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
  const { result } = renderHook(useSelectorSwipeKeyboardDismiss);
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
    const { result } = renderHook(useSelectorSwipeKeyboardDismiss);
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
  const { result } = renderHook(useSelectorSwipeKeyboardDismiss);
  expect(result.current).toEqual({});
  expect(mockKeyboardIsVisible).not.toHaveBeenCalled();
  expect(dismissMobileTokenSelectorKeyboard).not.toHaveBeenCalled();
});
