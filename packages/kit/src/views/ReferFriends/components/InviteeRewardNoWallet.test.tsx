/**
 * @jest-environment jsdom
 */
/* eslint-disable import/first */

import type { ReactNode } from 'react';

import { fireEvent, render, screen, waitFor } from '@testing-library/react';

const mockToOnBoardingPage = jest.fn();

jest.mock('react-intl', () => ({
  useIntl: () => ({
    formatMessage: ({ id }: { id: string }) => id,
  }),
}));

jest.mock('@onekeyhq/components', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  const Primitive = ({ children }: { children?: ReactNode }) =>
    React.createElement('div', null, children);

  return {
    Button: ({
      children,
      onPress,
      testID,
    }: {
      children?: ReactNode;
      onPress?: () => void | Promise<void>;
      testID?: string;
    }) =>
      React.createElement(
        'button',
        { 'data-testid': testID, onClick: onPress },
        children,
      ),
    Empty: Primitive,
    YStack: Primitive,
  };
});

jest.mock(
  '@onekeyhq/kit/src/views/Onboarding/hooks/useToOnBoardingPage',
  () => ({
    useToOnBoardingPage: () => mockToOnBoardingPage,
  }),
);

jest.mock('@onekeyhq/shared/src/platformEnv', () => ({
  __esModule: true,
  default: { isWebDappMode: false },
}));

import { InviteeRewardNoWallet } from './InviteeRewardNoWallet';

describe('InviteeRewardNoWallet', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('waits for the current overlay to close before opening onboarding', async () => {
    let resolveClose: (() => void) | undefined;
    const onBeforeNavigate = jest.fn(
      () =>
        new Promise<void>((resolve) => {
          resolveClose = resolve;
        }),
    );

    render(
      <InviteeRewardNoWallet
        testID="create-wallet"
        onBeforeNavigate={onBeforeNavigate}
      />,
    );

    fireEvent.click(screen.getByTestId('create-wallet'));
    expect(onBeforeNavigate).toHaveBeenCalledTimes(1);
    expect(mockToOnBoardingPage).not.toHaveBeenCalled();

    resolveClose?.();
    await waitFor(() => expect(mockToOnBoardingPage).toHaveBeenCalledTimes(1));
  });
});
