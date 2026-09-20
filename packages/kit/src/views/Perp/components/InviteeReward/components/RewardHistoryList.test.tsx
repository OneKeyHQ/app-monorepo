/** @jest-environment jsdom */
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

jest.mock('@onekeyhq/shared/src/utils/openUrlUtils', () => ({
  __esModule: true,
  default: {
    openUrlExternal: jest.fn(),
  },
}));

import type {
  IPerpsInviteeRewardHistoryItem,
  IPerpsInviteeRewardToken,
} from '@onekeyhq/shared/src/referralCode/type';
import openUrlUtils from '@onekeyhq/shared/src/utils/openUrlUtils';

import { RewardHistoryList } from './RewardHistoryList';

const mockOpenUrlExternal = jest.mocked(openUrlUtils.openUrlExternal);

const token: IPerpsInviteeRewardToken = {
  address: '0xtoken',
  logoURI: 'https://example.com/token.png',
  name: 'USD Coin',
  networkId: 'evm--42161',
  symbol: 'USDC',
};

function createHistoryItem(
  overrides: Partial<IPerpsInviteeRewardHistoryItem> = {},
): IPerpsInviteeRewardHistoryItem {
  return {
    date: '2026-09-08',
    tx: '0x298e9a1234567890abcdef123456788e5941',
    amount: '0.17',
    ...overrides,
  };
}

describe('RewardHistoryList', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('shows the empty state when history or token is missing', () => {
    const { rerender } = render(
      <RewardHistoryList history={[]} token={token} />,
    );

    expect(screen.getByText('global.no_data')).toBeTruthy();

    rerender(
      <RewardHistoryList history={[createHistoryItem()]} token={undefined} />,
    );

    expect(screen.getByText('global.no_data')).toBeTruthy();
  });

  it('renders raw dates, pages extra payouts, and opens Arbiscan externally', () => {
    const item = createHistoryItem();
    const history = [
      item,
      ...Array.from({ length: 10 }, (_, index) =>
        createHistoryItem({
          date: `2026-10-${String(index + 1).padStart(2, '0')}`,
          tx: `0x${String(index + 2).padStart(40, '0')}`,
          amount: String(index + 2),
        }),
      ),
    ];

    render(<RewardHistoryList history={history} token={token} />);

    expect(screen.getByText('2026-09-08')).toBeTruthy();
    expect(screen.getByText('perps.get_reward')).toBeTruthy();
    expect(screen.getByText('0x298e9a...8e5941')).toBeTruthy();
    expect(screen.getByText('0.17')).toBeTruthy();
    expect(screen.queryByText('0x000000...000011')).toBeNull();

    fireEvent.click(screen.getByTestId(`perp-invitee-reward-tx-${item.tx}`));
    expect(mockOpenUrlExternal).toHaveBeenCalledWith(
      `https://arbiscan.io/tx/${item.tx}`,
    );

    fireEvent.click(screen.getByTestId('perp-invitee-reward-show-more'));
    expect(screen.getByText('0x000000...000011')).toBeTruthy();
  });
});
