/**
 * @jest-environment jsdom
 */
/* eslint-disable import/first */

import type { ReactNode } from 'react';

import { fireEvent, render, screen } from '@testing-library/react';

import { ETranslations } from '@onekeyhq/shared/src/locale';
import type { ISwapInviteItem } from '@onekeyhq/shared/src/referralCode/type';

import { SwapDetailsSection } from './SwapDetailsSection';

const mockMedia = { md: false, xl: false };

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
    testID,
    userSelect,
  }: {
    children?: ReactNode;
    onPress?: () => void;
    testID?: string;
    userSelect?: string;
  }) =>
    onPress ? (
      <button
        type="button"
        onClick={onPress}
        data-testid={testID}
        data-user-select={userSelect}
      >
        {children}
      </button>
    ) : (
      <div data-testid={testID}>{children}</div>
    );

  return {
    Button: Stack,
    Icon: () => null,
    ScrollView: ({ children }: { children?: ReactNode }) => (
      <div>{children}</div>
    ),
    SizableText: ({ children }: { children?: ReactNode }) => (
      <span>{children}</span>
    ),
    Spinner: () => null,
    Switch: () => null,
    XStack: Stack,
    YStack: Stack,
    useMedia: () => mockMedia,
  };
});

jest.mock('@onekeyhq/kit/src/hooks/useFixedColumnShadow', () => ({
  useFixedColumnShadow: () => ({
    showShadow: false,
    scrollViewRef: { current: null },
    handleNativeScroll: jest.fn(),
    handleWebScroll: jest.fn(),
  }),
}));

jest.mock('@onekeyhq/shared/src/platformEnv', () => ({
  __esModule: true,
  default: { isNative: false },
}));

jest.mock('./SwapEmptyData', () => ({
  SwapEmptyData: () => <div data-testid="swap-reward-empty" />,
}));

jest.mock('./SwapInviteRecord', () => ({
  SwapInviteRecord: () => <div data-testid="swap-invite-record" />,
}));

const inviteItem: ISwapInviteItem = {
  _id: 'invitee-id',
  address: '0x12...7890',
  invitationTime: '2026-06-27T13:31:00.000Z',
  inviteCode: 'Swap',
  inviteCodeRemark: '',
  firstTradeTime: '2026-08-07T16:12:00.000Z',
  volume: '149.94',
  volumeFiatValue: '149.94',
  fee: '0.97',
  feeFiatValue: '0.97',
  reward: '0.19',
  rewardFiatValue: '0.19',
  hasUndistributed: false,
  token: {
    networkId: 'evm--1',
    address: '0xtoken',
    logoURI: 'https://example.com/token.png',
    name: 'USD Coin',
    symbol: 'USDC',
  },
};

describe('SwapDetailsSection sort headers', () => {
  it('sorts from the first click on a desktop header and disables text selection', () => {
    const onSort = jest.fn();

    render(
      <SwapDetailsSection
        records={[inviteItem]}
        activeTab="total"
        onTabChange={jest.fn()}
        hideZeroVolume
        onHideZeroVolumeChange={jest.fn()}
        sortBy="volume"
        sortOrder="desc"
        onSort={onSort}
        hasUserSorted={false}
        isLoadingMore={false}
        isTabLoading={false}
        hasError={false}
        onRetry={jest.fn()}
      />,
    );

    const feeHeader = screen.getByTestId('swap-reward-sort-fee');
    expect(feeHeader.getAttribute('data-user-select')).toBe('none');
    expect(feeHeader.textContent).toContain(
      ETranslations.referral_perps_onekey_fee,
    );

    fireEvent.click(feeHeader);

    expect(onSort).toHaveBeenCalledTimes(1);
    expect(onSort).toHaveBeenCalledWith('fee');
  });
});
