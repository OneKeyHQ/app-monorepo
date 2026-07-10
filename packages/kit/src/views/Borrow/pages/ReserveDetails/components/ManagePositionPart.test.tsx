/** @jest-environment jsdom */

import type { ReactNode } from 'react';

import { fireEvent, render, screen } from '@testing-library/react';

import type { IBorrowReserveDetail } from '@onekeyhq/shared/types/staking';

import { ManagePositionPart } from './ManagePositionPart';

const mockNavigation = {};
const mockPushToBorrowManagePosition = jest.fn();

jest.mock('@onekeyhq/components', () => ({
  Button: ({
    children,
    disabled,
    onPress,
    testID,
  }: {
    children?: ReactNode;
    disabled?: boolean;
    onPress?: () => void;
    testID?: string;
  }) => (
    <button
      data-testid={testID}
      disabled={disabled}
      onClick={onPress}
      type="button"
    >
      {children}
    </button>
  ),
  Divider: () => <hr />,
  Icon: () => null,
  SizableText: ({ children }: { children?: ReactNode }) => (
    <span>{children}</span>
  ),
  XStack: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
  YStack: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
}));

jest.mock('react-intl', () => ({
  useIntl: () => ({
    formatMessage: ({ id }: { id: string }) => id,
  }),
}));

jest.mock('@onekeyhq/kit/src/hooks/useAppNavigation', () => ({
  __esModule: true,
  default: () => mockNavigation,
}));

jest.mock(
  '@onekeyhq/kit/src/views/Staking/components/ProtocolDetails/EarnText',
  () => ({ EarnText: () => null }),
);

jest.mock(
  '@onekeyhq/kit/src/views/Staking/components/ProtocolDetails/EarnTooltip',
  () => ({ EarnTooltip: () => null }),
);

jest.mock(
  '@onekeyhq/kit/src/views/Staking/pages/ManagePosition/hooks/useManagePage',
  () => ({
    EManagePositionType: {
      Supply: 'supply',
      Borrow: 'borrow',
    },
  }),
);

jest.mock('../../../borrowUtils', () => ({
  BorrowNavigation: {
    pushToBorrowManagePosition: (...args: unknown[]) => {
      mockPushToBorrowManagePosition(...args);
    },
  },
}));

describe('ManagePositionPart', () => {
  beforeEach(() => {
    mockPushToBorrowManagePosition.mockClear();
  });

  it('keeps token and provider logos distinct for supply and borrow actions', () => {
    const userInfo = {
      walletBalance: {
        button: {
          disabled: false,
          text: { text: 'Supply' },
        },
      },
      availableBorrowBalance: {
        button: {
          disabled: false,
          text: { text: 'Borrow' },
        },
      },
    } as IBorrowReserveDetail['userInfo'];

    render(
      <ManagePositionPart
        accountId="account-1"
        userInfo={userInfo}
        networkId="evm--1"
        provider="aave"
        marketAddress="market-address"
        reserveAddress="reserve-address"
        symbol="USDC"
        logoURI="token-logo"
        providerLogoURI="provider-logo"
      />,
    );

    const [supplyButton, borrowButton] = screen.getAllByTestId('borrow-btn');
    fireEvent.click(supplyButton);
    fireEvent.click(borrowButton);

    expect(mockPushToBorrowManagePosition).toHaveBeenNthCalledWith(
      1,
      mockNavigation,
      expect.objectContaining({
        logoURI: 'token-logo',
        providerLogoURI: 'provider-logo',
        type: 'supply',
      }),
    );
    expect(mockPushToBorrowManagePosition).toHaveBeenNthCalledWith(
      2,
      mockNavigation,
      expect.objectContaining({
        logoURI: 'token-logo',
        providerLogoURI: 'provider-logo',
        type: 'borrow',
      }),
    );
  });
});
