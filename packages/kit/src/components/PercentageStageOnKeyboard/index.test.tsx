/** @jest-environment jsdom */

import type { ReactNode } from 'react';

import { PercentageStageOnKeyboard } from '.';

import { act, render, screen } from '@testing-library/react';

const mockPlatformEnv = { isNative: false, isNativeAndroid: false };
const mockUseIsKeyboardShown = jest.fn(() => false);
const mockKeyboard = {
  visible: false,
  showDuringSubscription: false,
  listeners: new Map<string, Set<() => void>>(),
};

jest.mock('react-native', () => ({
  Keyboard: {
    isVisible: () => mockKeyboard.visible,
    addListener: (event: string, listener: () => void) => {
      const listeners = mockKeyboard.listeners.get(event) ?? new Set();
      listeners.add(listener);
      mockKeyboard.listeners.set(event, listeners);
      if (mockKeyboard.showDuringSubscription && event === 'keyboardDidShow') {
        mockKeyboard.visible = true;
      }
      return { remove: () => listeners.delete(listener) };
    },
  },
}));

jest.mock('@onekeyhq/components', () => ({
  XStack: ({
    children,
    opacity,
  }: {
    children?: ReactNode;
    opacity?: number;
  }) => (
    <div data-opacity={opacity} data-testid="percentage-stage">
      {children}
    </div>
  ),
  useIsKeyboardShown: () => mockUseIsKeyboardShown(),
}));

jest.mock('./PercentageStageRow', () => ({
  PercentageStageRow: () => <span>percentage stages</span>,
}));

jest.mock('@onekeyhq/shared/src/platformEnv', () => ({
  __esModule: true,
  default: {
    get isNative() {
      return mockPlatformEnv.isNative;
    },
    get isNativeAndroid() {
      return mockPlatformEnv.isNativeAndroid;
    },
  },
}));

describe('PercentageStageOnKeyboard', () => {
  beforeEach(() => {
    mockPlatformEnv.isNative = false;
    mockPlatformEnv.isNativeAndroid = false;
    mockUseIsKeyboardShown.mockReturnValue(false);
    mockKeyboard.visible = false;
    mockKeyboard.showDuringSubscription = false;
    mockKeyboard.listeners.clear();
  });

  it('does not reserve keyboard space on non-native platforms', () => {
    render(<PercentageStageOnKeyboard reserveSpaceUntilKeyboardShown />);

    expect(screen.queryByTestId('percentage-stage')).toBeNull();
  });

  it('reserves hidden space before an expected native keyboard opens', () => {
    mockPlatformEnv.isNative = true;

    render(<PercentageStageOnKeyboard reserveSpaceUntilKeyboardShown />);

    expect(
      screen.getByTestId('percentage-stage').getAttribute('data-opacity'),
    ).toBe('0');
  });

  it('does not reserve native space when auto-focus is disabled', () => {
    mockPlatformEnv.isNative = true;

    render(
      <PercentageStageOnKeyboard reserveSpaceUntilKeyboardShown={false} />,
    );

    expect(screen.queryByTestId('percentage-stage')).toBeNull();
  });

  it('shows the Android bar when the keyboard is already open and the amount is focused', () => {
    mockPlatformEnv.isNative = true;
    mockPlatformEnv.isNativeAndroid = true;
    mockKeyboard.visible = true;

    render(<PercentageStageOnKeyboard isAmountFocused />);

    expect(
      screen.getByTestId('percentage-stage').getAttribute('data-opacity'),
    ).toBe('1');
  });

  it('reconciles an Android keyboard event before subscriptions complete', () => {
    mockPlatformEnv.isNative = true;
    mockPlatformEnv.isNativeAndroid = true;
    mockKeyboard.showDuringSubscription = true;

    render(<PercentageStageOnKeyboard isAmountFocused />);

    expect(
      screen.getByTestId('percentage-stage').getAttribute('data-opacity'),
    ).toBe('1');
  });

  it('requires amount focus and hides when the Android keyboard closes', () => {
    mockPlatformEnv.isNative = true;
    mockPlatformEnv.isNativeAndroid = true;
    mockKeyboard.visible = true;

    const view = render(<PercentageStageOnKeyboard isAmountFocused={false} />);
    expect(screen.queryByTestId('percentage-stage')).toBeNull();

    view.rerender(<PercentageStageOnKeyboard isAmountFocused />);
    expect(screen.getByTestId('percentage-stage')).toBeTruthy();

    act(() => {
      mockKeyboard.visible = false;
      mockKeyboard.listeners
        .get('keyboardDidHide')
        ?.forEach((listener) => listener());
    });
    expect(screen.queryByTestId('percentage-stage')).toBeNull();
  });

  it('shows again after an Android footer is remounted while the keyboard stays open', () => {
    mockPlatformEnv.isNative = true;
    mockPlatformEnv.isNativeAndroid = true;
    mockKeyboard.visible = true;

    const view = render(<PercentageStageOnKeyboard isAmountFocused />);
    view.unmount();
    render(<PercentageStageOnKeyboard isAmountFocused />);

    expect(
      screen.getByTestId('percentage-stage').getAttribute('data-opacity'),
    ).toBe('1');
  });
});
