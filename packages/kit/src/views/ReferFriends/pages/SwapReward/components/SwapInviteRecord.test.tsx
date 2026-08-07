/**
 * @jest-environment jsdom
 */
/* eslint-disable import/first */

import type { ReactNode } from 'react';

import { render, screen } from '@testing-library/react';

import type { ISwapInviteItem } from '@onekeyhq/shared/src/referralCode/type';

jest.mock('react-intl', () => ({
  useIntl: () => ({
    formatMessage: ({ id }: { id: string }) => id,
  }),
}));

jest.mock('react-native', () => ({
  StyleSheet: { hairlineWidth: 1 },
}));

jest.mock('@onekeyhq/components', () => {
  const Stack = ({ children }: { children?: ReactNode }) => (
    <div>{children}</div>
  );
  const SizableText = ({
    children,
    ellipsizeMode,
    numberOfLines,
    width,
  }: {
    children?: ReactNode;
    ellipsizeMode?: string;
    numberOfLines?: number;
    width?: string | number;
  }) => (
    <span
      data-ellipsize-mode={ellipsizeMode}
      data-number-of-lines={numberOfLines}
      data-width={width}
    >
      {children}
    </span>
  );
  const YStack = ({
    children,
    width,
  }: {
    children?: ReactNode;
    width?: string | number;
  }) => <div data-width={width}>{children}</div>;

  return {
    Badge: Stack,
    Button: Stack,
    Icon: () => null,
    NumberSizeableText: SizableText,
    SizableText,
    Spinner: () => null,
    Stack,
    XStack: Stack,
    YStack,
  };
});

jest.mock('@onekeyhq/kit/src/components/Currency', () => ({
  Currency: ({ children }: { children?: ReactNode }) => <span>{children}</span>,
}));

jest.mock('@onekeyhq/kit/src/utils/explorerUtils', () => ({
  openTransactionDetailsUrl: jest.fn(),
}));

jest.mock('../hooks/useSwapRecordDetails', () => ({
  useSwapRecordDetails: () => ({
    hasError: false,
    isLoading: false,
    records: undefined,
    retry: jest.fn(),
  }),
}));

jest.mock('./SwapRewardStatusBadge', () => ({
  SwapRewardStatusBadge: () => null,
}));

import { SwapInviteRecord } from './SwapInviteRecord';

const LONG_REMARK =
  'https://onekey.example/r/remark-that-is-much-longer-than-the-column-width';

const inviteItem: ISwapInviteItem = {
  _id: 'invitee-id',
  address: '0x12...7890',
  invitationTime: null,
  inviteCode: 'ONEKEY',
  inviteCodeRemark: LONG_REMARK,
  firstTradeTime: null,
  volume: '1',
  volumeFiatValue: '1',
  fee: '0.01',
  feeFiatValue: '0.01',
  reward: '0.005',
  rewardFiatValue: '0.005',
  hasUndistributed: true,
  token: {
    networkId: 'evm--1',
    address: '0xtoken',
    logoURI: 'https://example.com/token.png',
    name: 'USD Coin',
    symbol: 'USDC',
  },
};

describe('SwapInviteRecord', () => {
  it('constrains long invite-code remarks to a single ellipsized line', () => {
    render(
      <SwapInviteRecord
        item={inviteItem}
        query={{}}
        status={undefined}
        variant="desktop"
      />,
    );

    const remark = screen.getByText(LONG_REMARK);
    expect(remark.getAttribute('data-number-of-lines')).toBe('1');
    expect(remark.getAttribute('data-ellipsize-mode')).toBe('tail');
    expect(remark.getAttribute('data-width')).toBe('100%');
    expect(remark.parentElement?.getAttribute('data-width')).toBe('100%');
  });
});
