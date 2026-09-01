/**
 * @jest-environment jsdom
 */
/* eslint-disable import/first */

import type { ReactNode } from 'react';

import { fireEvent, render, screen } from '@testing-library/react';

import { ETranslations } from '@onekeyhq/shared/src/locale';
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
  const Stack = ({
    children,
    onPress,
  }: {
    children?: ReactNode;
    onPress?: () => void;
  }) =>
    onPress ? (
      <button type="button" onClick={onPress}>
        {children}
      </button>
    ) : (
      <div>{children}</div>
    );
  const SizableText = ({ children }: { children?: ReactNode }) => (
    <span>{children}</span>
  );
  const YStack = ({
    children,
    onPress,
  }: {
    children?: ReactNode;
    onPress?: () => void;
  }) =>
    onPress ? (
      <button type="button" onClick={onPress}>
        {children}
      </button>
    ) : (
      <div>{children}</div>
    );

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
  it.each(['desktop', 'mobile'] as const)(
    'hides invite-code remarks on %s invite history',
    (variant) => {
      render(<SwapInviteRecord item={inviteItem} variant={variant} />);

      expect(screen.getByText('ONEKEY')).toBeTruthy();
      expect(screen.queryByText(LONG_REMARK)).toBeNull();
    },
  );

  it('keeps desktop invite rows summary-only and non-expandable', () => {
    render(<SwapInviteRecord item={inviteItem} variant="desktop" />);

    expect(screen.queryByRole('button')).toBeNull();
    expect(screen.queryByText(ETranslations.global_transaction_id)).toBeNull();
  });

  it('expands only aggregate fields on mobile', () => {
    render(<SwapInviteRecord item={inviteItem} variant="mobile" />);

    fireEvent.click(screen.getByRole('button'));

    expect(
      screen.getByText(ETranslations.referral_perps_invited_at),
    ).toBeTruthy();
    expect(
      screen.getByText(ETranslations.referral_perps_first_trade),
    ).toBeTruthy();
    expect(
      screen.getByText(ETranslations.referral_perps_onekey_fee),
    ).toBeTruthy();
    expect(screen.queryByText(ETranslations.global_transaction_id)).toBeNull();
    expect(screen.queryByText(ETranslations.earn_period)).toBeNull();
  });
});
