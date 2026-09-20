/**
 * @jest-environment jsdom
 */
/* eslint-disable import/first */

import type { ReactNode } from 'react';

import { fireEvent, render, screen } from '@testing-library/react';

import { ETranslations } from '@onekeyhq/shared/src/locale';
import type { IPerpsInviteItem } from '@onekeyhq/shared/src/referralCode/type';

import { PerpsRecordTable } from './PerpsRecordTable';

const mockMedia = { xl: false };

jest.mock('react-intl', () => ({
  useIntl: () => ({
    formatMessage: ({ id }: { id: string }) => id,
  }),
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
    Badge: ({ children }: { children?: ReactNode }) => <span>{children}</span>,
    Icon: () => null,
    Popover: {
      Tooltip: () => <span data-testid="perps-fee-tooltip" />,
    },
    ScrollView: ({ children }: { children?: ReactNode }) => (
      <div>{children}</div>
    ),
    SizableText: ({ children }: { children?: ReactNode }) => (
      <span>{children}</span>
    ),
    Spinner: () => null,
    XStack: Stack,
    YStack: Stack,
    useMedia: () => mockMedia,
  };
});

jest.mock('@onekeyhq/kit/src/components/Currency', () => ({
  Currency: ({ children }: { children?: ReactNode }) => <span>{children}</span>,
}));

jest.mock('@onekeyhq/kit/src/components/FixedColumnShadowOverlay', () => ({
  FixedColumnShadowOverlay: () => null,
}));

jest.mock('@onekeyhq/kit/src/hooks/useFixedColumnShadow', () => ({
  SHADOW_CONSTANTS: { TRANSITION_DURATION: '0s' },
  getWebClipPath: () => undefined,
  getWebShadowStyle: () => undefined,
  useFixedColumnShadow: () => ({
    showShadow: false,
    scrollViewRef: { current: null },
    handleNativeScroll: jest.fn(),
    handleWebScroll: jest.fn(),
  }),
}));

jest.mock('@onekeyhq/kit/src/hooks/useThemeVariant', () => ({
  useThemeVariant: () => 'light',
}));

jest.mock('@onekeyhq/shared/src/platformEnv', () => ({
  __esModule: true,
  default: { isNative: false },
}));

jest.mock('@onekeyhq/shared/src/utils/dateUtils', () => ({
  formatDate: () => '2026-06-27',
}));

const inviteItem: IPerpsInviteItem = {
  _id: 'invitee-id',
  address: '0x12...7890',
  invitationTime: '2026-06-27T13:31:00.000Z',
  inviteCode: 'Perps',
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

describe('PerpsRecordTable sort headers', () => {
  it('sorts from the first click on a combined desktop header', () => {
    const onSort = jest.fn();

    render(
      <PerpsRecordTable
        records={[inviteItem]}
        sortBy="volume"
        sortOrder="desc"
        onSort={onSort}
        hasUserSorted={false}
      />,
    );

    const feeHeader = screen.getByTestId('perps-reward-sort-fee');
    expect(feeHeader.getAttribute('data-user-select')).toBe('none');
    expect(feeHeader.textContent).toContain(
      ETranslations.referral_perps_onekey_fee,
    );
    expect(screen.getByTestId('perps-fee-tooltip')).toBeTruthy();

    fireEvent.click(feeHeader);

    expect(onSort).toHaveBeenCalledTimes(1);
    expect(onSort).toHaveBeenCalledWith('fee');
  });
});
