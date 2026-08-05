/**
 * @jest-environment jsdom
 */
/* eslint-disable import/first */

import type { ReactNode } from 'react';

import { fireEvent, render, screen } from '@testing-library/react';

jest.mock('react-intl', () => ({
  useIntl: () => ({
    formatMessage: ({ id }: { id: string }) => id,
  }),
}));

jest.mock('@onekeyhq/components', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  const copyUrl = jest.fn();

  return {
    __copyUrl: copyUrl,
    Button: ({
      children,
      loading,
      onPress,
      testID,
    }: {
      children?: ReactNode;
      loading?: boolean;
      onPress?: () => void;
      testID?: string;
    }) => (
      <button
        data-loading={String(Boolean(loading))}
        disabled={loading}
        onClick={onPress}
        data-testid={testID}
        type="button"
      >
        {children}
      </button>
    ),
    Empty: () => React.createElement('div'),
    YStack: ({ children }: { children?: ReactNode }) =>
      React.createElement('div', null, children),
    useClipboard: () => ({ copyUrl }),
  };
});

jest.mock(
  '@onekeyhq/kit/src/views/Perp/components/PositionShare/useReferralUrl',
  () => ({
    useReferralUrl: jest.fn(),
  }),
);

import { SwapEmptyData } from './SwapEmptyData';

function getMocks() {
  return {
    copyUrl: jest.requireMock('@onekeyhq/components').__copyUrl as jest.Mock,
    useReferralUrl: jest.requireMock(
      '@onekeyhq/kit/src/views/Perp/components/PositionShare/useReferralUrl',
    ).useReferralUrl as jest.Mock,
  };
}

describe('SwapEmptyData', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('waits for the referral URL before enabling copy', () => {
    const mocks = getMocks();
    mocks.useReferralUrl.mockReturnValue({
      referralQrCodeUrl: 'https://app.onekey.so/swap',
      isReady: false,
    });

    const { rerender } = render(<SwapEmptyData />);
    const copyButton = screen.getByTestId('swap-reward-copy-link-btn');

    expect((copyButton as HTMLButtonElement).disabled).toBe(true);
    expect(copyButton.getAttribute('data-loading')).toBe('true');
    fireEvent.click(copyButton);
    expect(mocks.copyUrl).not.toHaveBeenCalled();

    const referralUrl = 'https://app.onekey.so/r/ABC123/app/swap';
    mocks.useReferralUrl.mockReturnValue({
      referralQrCodeUrl: referralUrl,
      isReady: true,
    });
    rerender(<SwapEmptyData />);

    expect((copyButton as HTMLButtonElement).disabled).toBe(false);
    expect(copyButton.getAttribute('data-loading')).toBe('false');
    fireEvent.click(copyButton);
    expect(mocks.copyUrl).toHaveBeenCalledWith(referralUrl);
  });
});
