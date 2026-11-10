/** @jest-environment jsdom */

import type { ReactNode } from 'react';

import { act, render, screen } from '@testing-library/react';

import { DustSweepActionTouch } from './DustSweepActionTouch.android';

type IAccessibilityEvent = { nativeEvent: { actionName: string } };
let mockAccessibilityAction: ((event: IAccessibilityEvent) => void) | undefined;
const mockEnabled = jest.fn();
const mockClick = jest.fn<void, [{ trackId: string }]>();
const mockHandlers: {
  begin?: () => void;
  end?: (event: unknown, success: boolean) => void;
  finalize?: () => void;
} = {};

jest.mock('react-native', () => ({
  StyleSheet: { create: (styles: object) => styles },
  View: ({
    children,
    testID,
    accessibilityLabel,
    accessibilityState,
    onAccessibilityAction,
  }: {
    children: ReactNode;
    testID: string;
    accessibilityLabel: string;
    accessibilityState: { disabled: boolean };
    onAccessibilityAction?: (event: IAccessibilityEvent) => void;
  }) => {
    mockAccessibilityAction = onAccessibilityAction;
    return (
      <div
        data-testid={testID}
        aria-label={accessibilityLabel}
        aria-disabled={accessibilityState.disabled}
      >
        {children}
      </div>
    );
  },
}));

jest.mock('react-native-gesture-handler', () => ({
  GestureDetector: ({ children }: { children: ReactNode }) => children,
  Gesture: {
    Tap: () => {
      const gesture = {
        enabled: (enabled: boolean) => {
          mockEnabled(enabled);
          return gesture;
        },
        onBegin: (handler: () => void) => {
          mockHandlers.begin = handler;
          return gesture;
        },
        onEnd: (handler: (event: unknown, success: boolean) => void) => {
          mockHandlers.end = handler;
          return gesture;
        },
        onFinalize: (handler: () => void) => {
          mockHandlers.finalize = handler;
          return gesture;
        },
      };
      return gesture;
    },
  },
}));

jest.mock('react-native-reanimated', () => ({
  runOnJS: (fn: (...args: unknown[]) => unknown) => fn,
}));

jest.mock('@onekeyhq/shared/src/logger/logger', () => ({
  defaultLogger: {
    ui: {
      button: { click: (params: { trackId: string }) => mockClick(params) },
    },
  },
}));

beforeEach(() => {
  jest.clearAllMocks();
  mockAccessibilityAction = undefined;
});

function renderAction({
  disabled = false,
  enabled = true,
  onPress = jest.fn(),
}: {
  disabled?: boolean;
  enabled?: boolean;
  onPress?: () => void;
} = {}) {
  return render(
    <DustSweepActionTouch
      enabled={enabled}
      disabled={disabled}
      accessibilityLabel="Convert 1 token"
      onPress={onPress}
    >
      {(handlesPress, pressed) => (
        <div
          data-testid="child"
          data-handles={handlesPress}
          data-pressed={pressed}
        />
      )}
    </DustSweepActionTouch>,
  );
}

it('fires one action only for a recognized tap and restores the pressed state', () => {
  const onPress = jest.fn();
  renderAction({ onPress });
  expect(mockEnabled).toHaveBeenLastCalledWith(true);
  act(() => mockHandlers.begin?.());
  expect(screen.getByTestId('child').getAttribute('data-pressed')).toBe('true');
  act(() => mockHandlers.end?.(undefined, false));
  expect(onPress).not.toHaveBeenCalled();
  act(() => {
    mockHandlers.end?.(undefined, true);
    mockHandlers.finalize?.();
  });
  expect(onPress).toHaveBeenCalledTimes(1);
  expect(mockClick).toHaveBeenCalledWith({ trackId: 'dust-sweep-action' });
  expect(screen.getByTestId('child').getAttribute('data-pressed')).toBe(
    'false',
  );
});

it('supports accessibility activation and ignores other actions', () => {
  const onPress = jest.fn();
  renderAction({ onPress });
  expect(
    screen.getByTestId('dust-sweep-action').getAttribute('aria-label'),
  ).toBe('Convert 1 token');
  act(() =>
    mockAccessibilityAction?.({ nativeEvent: { actionName: 'other' } }),
  );
  expect(onPress).not.toHaveBeenCalled();
  act(() =>
    mockAccessibilityAction?.({ nativeEvent: { actionName: 'activate' } }),
  );
  expect(onPress).toHaveBeenCalledTimes(1);
});

it('rejects a queued tap and accessibility activation after becoming disabled', () => {
  const onPress = jest.fn();
  const { rerender } = renderAction({ onPress });
  const oldEnd = mockHandlers.end;
  rerender(
    <DustSweepActionTouch
      enabled
      disabled
      accessibilityLabel="Convert 1 token"
      onPress={onPress}
    >
      {() => <div />}
    </DustSweepActionTouch>,
  );
  expect(mockEnabled).toHaveBeenLastCalledWith(false);
  act(() => oldEnd?.(undefined, true));
  act(() =>
    mockAccessibilityAction?.({ nativeEvent: { actionName: 'activate' } }),
  );
  expect(onPress).not.toHaveBeenCalled();
  expect(mockClick).not.toHaveBeenCalled();
});

it('does not run a queued selection tap after leaving the selection phase', () => {
  const onPress = jest.fn();
  const { rerender } = renderAction({ onPress });
  const oldEnd = mockHandlers.end;
  rerender(
    <DustSweepActionTouch
      enabled={false}
      disabled={false}
      accessibilityLabel="Pause"
      onPress={onPress}
    >
      {(handlesPress) => (
        <div data-testid="child" data-handles={handlesPress} />
      )}
    </DustSweepActionTouch>,
  );
  act(() => oldEnd?.(undefined, true));
  expect(onPress).not.toHaveBeenCalled();
  expect(screen.getByTestId('child').getAttribute('data-handles')).toBe(
    'false',
  );
});

it('uses the latest handler for a queued tap and ignores it after unmount', () => {
  const originalOnPress = jest.fn();
  const latestOnPress = jest.fn();
  const { rerender, unmount } = renderAction({ onPress: originalOnPress });
  const oldEnd = mockHandlers.end;
  const oldFinalize = mockHandlers.finalize;
  rerender(
    <DustSweepActionTouch
      enabled
      disabled={false}
      accessibilityLabel="Convert 1 token"
      onPress={latestOnPress}
    >
      {() => <div />}
    </DustSweepActionTouch>,
  );
  act(() => oldEnd?.(undefined, true));
  expect(originalOnPress).not.toHaveBeenCalled();
  expect(latestOnPress).toHaveBeenCalledTimes(1);
  unmount();
  act(() => {
    oldEnd?.(undefined, true);
    oldFinalize?.();
  });
  expect(latestOnPress).toHaveBeenCalledTimes(1);
});
