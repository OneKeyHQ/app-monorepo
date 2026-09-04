/** @jest-environment jsdom */

import type { ReactNode } from 'react';

import { render, screen } from '@testing-library/react';

import { ETranslations } from '@onekeyhq/shared/src/locale';

import { AuthFailureCard } from './AuthPanels';

jest.mock('react-intl', () => ({
  useIntl: () => ({
    formatMessage: ({ id }: { id: string }) => id,
  }),
}));

jest.mock('../../primitives', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  const Div = ({ children }: { children?: ReactNode }) =>
    React.createElement('div', undefined, children);
  const Button = ({
    children,
    testID,
  }: {
    children?: ReactNode;
    testID?: string;
  }) => React.createElement('button', { 'data-testid': testID }, children);

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
