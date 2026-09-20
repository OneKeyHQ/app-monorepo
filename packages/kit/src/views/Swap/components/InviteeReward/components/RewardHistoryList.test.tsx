/** @jest-environment jsdom */
/* eslint-disable import/first */

import type { ReactNode } from 'react';

import { fireEvent, render, screen } from '@testing-library/react';

const mockFormatDate = jest.fn((date: string) => `formatted:${date}`);

jest.mock('react-intl', () => ({
  useIntl: () => ({
    formatMessage: ({ id }: { id: string }) => id,
  }),
}));

jest.mock('@onekeyhq/components', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  const Primitive = ({
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
      { 'data-testid': testID, onClick: onPress },
      children,
    );

  return {
    Icon: Primitive,
    NumberSizeableText: Primitive,
    SizableText: Primitive,
    Skeleton: Primitive,
    XStack: Primitive,
    YStack: Primitive,
  };
});

jest.mock('@onekeyhq/kit/src/components/Token', () => ({
  Token: () => <div />,
}));

jest.mock('@onekeyhq/kit/src/hooks/useFormatDate', () => ({
  __esModule: true,
  default: () => ({ formatDate: mockFormatDate }),
}));

jest.mock('@onekeyhq/kit/src/utils/explorerUtils', () => ({
  openTransactionDetailsUrl: jest.fn(),
}));

import { openTransactionDetailsUrl } from '@onekeyhq/kit/src/utils/explorerUtils';
import type { ISwapInviteeRewardHistoryItem } from '@onekeyhq/shared/src/referralCode/type';

import { RewardHistoryList } from './RewardHistoryList';

const mockOpenTransactionDetailsUrl = jest.mocked(openTransactionDetailsUrl);

const historyToken: ISwapInviteeRewardHistoryItem['token'] = {
  networkId: 'evm--42161',
  address: '0xtoken',
  logoURI: 'https://example.com/token.png',
  name: 'USD Coin',
  symbol: 'USDC',
};

function createHistoryItem(
  overrides: Partial<ISwapInviteeRewardHistoryItem> = {},
): ISwapInviteeRewardHistoryItem {
  return {
    date: '2026-08-03',
    tx: '0x1234567890abcdef1234567890abcdef12345678',
    amount: '1.25',
    token: historyToken,
    ...overrides,
  };
}

describe('RewardHistoryList', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('formats the server date with the active app locale', () => {
    render(
      <RewardHistoryList
        history={[
          createHistoryItem({
            date: '2026-08-03',
            tx: '',
            amount: '1',
          }),
        ]}
      />,
    );

    expect(mockFormatDate).toHaveBeenCalledWith('2026-08-03', {
      hideTimeForever: true,
    });
    expect(screen.getByText('formatted:2026-08-03')).toBeTruthy();
    expect(
      screen.getByText('referral.reward_history_reward_title'),
    ).toBeTruthy();
  });

  it('shows the empty state when there is no payout history', () => {
    render(<RewardHistoryList history={[]} />);

    expect(screen.getByText('global.no_data')).toBeTruthy();
  });

  it('pages extra payouts and opens the matching explorer url', () => {
    const history = Array.from({ length: 11 }, (_, index) =>
      createHistoryItem({
        date: `2026-08-${String(index + 1).padStart(2, '0')}`,
        tx: `0x${String(index + 1).padStart(40, '0')}`,
        amount: String(index + 1),
      }),
    );

    render(<RewardHistoryList history={history} />);

    expect(screen.getByText('0x000000...000001')).toBeTruthy();
    expect(screen.queryByText('0x000000...000011')).toBeNull();

    fireEvent.click(screen.getByTestId('swap-invitee-reward-show-more'));

    expect(screen.getByText('0x000000...000011')).toBeTruthy();

    fireEvent.click(
      screen.getByTestId(`swap-invitee-reward-tx-${history[0].tx}`),
    );

    expect(mockOpenTransactionDetailsUrl).toHaveBeenCalledWith({
      networkId: 'evm--42161',
      txid: history[0].tx,
    });
  });
});
