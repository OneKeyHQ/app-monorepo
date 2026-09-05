/** @jest-environment jsdom */

import type { ReactNode } from 'react';

import { fireEvent, render, screen } from '@testing-library/react';

import { ETranslations } from '@onekeyhq/shared/src/locale';

import { AuthFailureCard } from './AuthPanels';

let mockIsDev = false;
jest.mock('@onekeyhq/shared/src/platformEnv', () => ({
  __esModule: true,
  default: {
    get isDev() {
      return mockIsDev;
    },
  },
}));

jest.mock('react-intl', () => ({
  useIntl: () => ({
    formatMessage: ({ id }: { id: string }) => id,
  }),
}));

jest.mock('../../primitives', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  const Div = ({
    children,
    onPress,
    testID,
  }: {
    children?: ReactNode;
    onPress?: () => void;
    testID?: string;
  }) =>
    React.createElement(
      'div',
      { onClick: onPress, 'data-testid': testID },
      children,
    );
  const Button = ({
    children,
    testID,
    onPress,
  }: {
    children?: ReactNode;
    testID?: string;
    onPress?: () => void;
  }) =>
    React.createElement(
      'button',
      { onClick: onPress, 'data-testid': testID },
      children,
    );

  return {
    Anchor: Div,
    Button,
    Icon: Div,
    SizableText: Div,
    Spinner: Div,
    Stack: Div,
    XStack: Div,
    YStack: Div,
  };
});

jest.mock('./StepText', () => ({
  StepText: ({ title, sub }: { title: string; sub?: string }) => (
    <>
      <span>{title}</span>
      <span>{sub}</span>
    </>
  ),
}));

describe('AuthFailureCard fail-closed actions', () => {
  beforeEach(() => {
    mockIsDev = false;
  });

  it.each(['unofficialDevice', 'unofficialFirmware'] as const)(
    'retains the hidden production override for %s and resets it between attempts',
    (reason) => {
      const onContinueAnyway = jest.fn();
      const { rerender } = render(
        <AuthFailureCard
          reason={reason}
          onContinueAnyway={onContinueAnyway}
          resetSignal={0}
        />,
      );
      const trigger = screen.getByTestId('device-stage-auth-dev-skip-trigger');
      for (let i = 0; i < 9; i += 1) fireEvent.click(trigger);
      expect(screen.queryByTestId('device-stage-auth-dev-skip')).toBeNull();
      fireEvent.click(trigger);
      fireEvent.click(screen.getByTestId('device-stage-auth-dev-skip'));
      expect(onContinueAnyway).toHaveBeenCalledTimes(1);
      expect(
        screen.queryByText(ETranslations.global_continue_anyway),
      ).toBeNull();

      rerender(
        <AuthFailureCard
          reason={reason}
          onContinueAnyway={onContinueAnyway}
          resetSignal={1}
        />,
      );
      expect(screen.queryByTestId('device-stage-auth-dev-skip')).toBeNull();
      fireEvent.click(trigger);
      expect(screen.queryByTestId('device-stage-auth-dev-skip')).toBeNull();
    },
  );

  it.each([
    'unofficialDevice',
    'unofficialFirmware',
    'network',
    'unavailable',
    'unknown',
    'defective',
  ] as const)(
    'limits the visible development override for %s to unofficial verdicts',
    (reason) => {
      mockIsDev = true;
      render(<AuthFailureCard reason={reason} onContinueAnyway={jest.fn()} />);
      const button = screen.queryByTestId('device-stage-auth-dev-skip');
      if (reason === 'unofficialDevice' || reason === 'unofficialFirmware') {
        expect(button).toBeTruthy();
      } else {
        expect(button).toBeNull();
      }
    },
  );

  it('shows retry and support for an unknown result without a bypass action', () => {
    render(
      <AuthFailureCard
        reason="unknown"
        onRetry={jest.fn()}
        onSupport={jest.fn()}
      />,
    );

    expect(
      screen.getByText(ETranslations.send_verification_failure),
    ).toBeTruthy();
    expect(
      screen.getByText(ETranslations.global_unknown_error_retry_message),
    ).toBeTruthy();
    expect(
      screen.queryByText(
        ETranslations.device_auth_unofficial_device_detected_help_text,
      ),
    ).toBeNull();
    expect(screen.getByTestId('device-stage-auth-retry')).toBeTruthy();
    expect(screen.getByTestId('device-stage-auth-support')).toBeTruthy();
    expect(screen.queryByTestId('device-stage-auth-note-open')).toBeNull();
    expect(screen.queryByText(ETranslations.global_continue_anyway)).toBeNull();
  });

  it('only offers support for an unofficial device', () => {
    render(
      <AuthFailureCard
        reason="unofficialDevice"
        onRetry={jest.fn()}
        onSupport={jest.fn()}
      />,
    );

    expect(screen.getByTestId('device-stage-auth-support')).toBeTruthy();
    expect(screen.queryByTestId('device-stage-auth-retry')).toBeNull();
  });
});
