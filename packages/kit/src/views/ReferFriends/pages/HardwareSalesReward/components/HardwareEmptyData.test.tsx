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

  const TestButton = ({
    children,
    disabled,
    loading,
    onPress,
    testID,
  }: {
    children?: ReactNode;
    disabled?: boolean;
    loading?: boolean;
    onPress?: () => void;
    testID?: string;
  }) => (
    <button
      data-loading={String(Boolean(loading))}
      disabled={Boolean(disabled || loading)}
      onClick={onPress}
      data-testid={testID}
      type="button"
    >
      {children}
    </button>
  );

  return {
    __copyUrl: copyUrl,
    Button: TestButton,
    Empty: ({
      buttonProps,
    }: {
      buttonProps?: React.ComponentProps<typeof TestButton>;
    }) => (
      <div data-testid="hardware-reward-empty-content">
        {buttonProps ? <TestButton {...buttonProps} /> : null}
      </div>
    ),
    YStack: ({ children }: { children?: ReactNode }) =>
      React.createElement('div', null, children),
    useClipboard: () => ({ copyUrl }),
  };
});

jest.mock('./useHardwareShopInviteUrl', () => ({
  useHardwareShopInviteUrl: jest.fn(),
}));

import { ReferFriendsTestIDs } from '../../../testIDs';

import { HardwareEmptyData } from './HardwareEmptyData';

function getMocks() {
  return {
    copyUrl: jest.requireMock('@onekeyhq/components').__copyUrl as jest.Mock,
    useHardwareShopInviteUrl: jest.requireMock('./useHardwareShopInviteUrl')
      .useHardwareShopInviteUrl as jest.Mock,
  };
}

describe('HardwareEmptyData', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('waits for the shop invite URL before enabling copy', () => {
    const mocks = getMocks();
    mocks.useHardwareShopInviteUrl.mockReturnValue({
      shopInviteUrl: '',
      isReady: false,
    });

    const { rerender } = render(<HardwareEmptyData />);
    const copyButton = screen.getByTestId(
      ReferFriendsTestIDs.hardwareEmptyCopyLinkBtn,
    );

    expect((copyButton as HTMLButtonElement).disabled).toBe(true);
    expect(copyButton.getAttribute('data-loading')).toBe('true');
    fireEvent.click(copyButton);
    expect(mocks.copyUrl).not.toHaveBeenCalled();

    const shopInviteUrl = 'https://onekey.so/r/ABC123/shop';
    mocks.useHardwareShopInviteUrl.mockReturnValue({
      shopInviteUrl,
      isReady: true,
    });
    rerender(<HardwareEmptyData />);

    expect((copyButton as HTMLButtonElement).disabled).toBe(false);
    expect(copyButton.getAttribute('data-loading')).toBe('false');
    fireEvent.click(copyButton);
    expect(mocks.copyUrl).toHaveBeenCalledWith(shopInviteUrl);
  });

  it('does not copy when the invite URL never arrives', () => {
    const mocks = getMocks();
    mocks.useHardwareShopInviteUrl.mockReturnValue({
      shopInviteUrl: '',
      isReady: true,
    });

    render(<HardwareEmptyData />);
    const copyButton = screen.getByTestId(
      ReferFriendsTestIDs.hardwareEmptyCopyLinkBtn,
    );

    expect((copyButton as HTMLButtonElement).disabled).toBe(true);
    expect(copyButton.getAttribute('data-loading')).toBe('false');
    fireEvent.click(copyButton);
    expect(mocks.copyUrl).not.toHaveBeenCalled();
  });
});
