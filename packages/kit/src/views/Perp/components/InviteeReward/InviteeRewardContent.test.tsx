/** @jest-environment jsdom */
/* eslint-disable import/first */

import type { ReactNode } from 'react';

import { render, screen } from '@testing-library/react';

let mockPromiseResult: {
  result?: {
    totalBonus: string;
    undistributed: string;
    token: {
      symbol: string;
      logoURI: string;
    };
    history: {
      date: string;
      tx: string;
      amount: string;
    }[];
  };
  isLoading?: boolean;
};

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
    Button: ({ children, testID }: { children?: ReactNode; testID?: string }) =>
      React.createElement('button', { 'data-testid': testID }, children),
    Divider: Primitive,
    Empty: Primitive,
    ScrollView: ({ children }: { children?: ReactNode }) =>
      React.createElement('div', { 'data-testid': 'scroll-view' }, children),
    SizableText: Primitive,
    YStack: Primitive,
  };
});

jest.mock('@onekeyhq/kit/src/hooks/usePromiseResult', () => ({
  usePromiseResult: () => mockPromiseResult,
}));

jest.mock('@onekeyhq/kit/src/background/instance/backgroundApiProxy', () => ({
  __esModule: true,
  default: {
    serviceReferralCode: {
      getPerpsInviteeRewards: jest.fn(),
    },
  },
}));

jest.mock(
  '@onekeyhq/kit/src/views/Onboarding/hooks/useToOnBoardingPage',
  () => ({
    useToOnBoardingPage: jest.fn(),
  }),
);

jest.mock('./components/RewardSummaryCard', () => ({
  RewardSummaryCard: ({
    isLoading,
    totalBonus,
    undistributed,
    tokenSymbol,
  }: {
    isLoading?: boolean;
    totalBonus?: string;
    undistributed?: string;
    tokenSymbol?: string;
  }) => (
    <div
      data-testid="reward-summary"
      data-loading={isLoading ? 'true' : 'false'}
    >
      {totalBonus}:{undistributed}:{tokenSymbol}
    </div>
  ),
}));

jest.mock('./components/RewardHistoryList', () => ({
  RewardHistoryList: ({
    isLoading,
    history,
  }: {
    isLoading?: boolean;
    history?: unknown[];
  }) => (
    <div
      data-testid="reward-history-list"
      data-loading={isLoading ? 'true' : 'false'}
      data-count={String(history?.length ?? 0)}
    />
  ),
}));

import { InviteeRewardContent } from './InviteeRewardContent';

describe('InviteeRewardContent', () => {
  beforeEach(() => {
    mockPromiseResult = {
      result: {
        totalBonus: '12',
        undistributed: '3',
        token: {
          symbol: 'USDC',
          logoURI: '',
        },
        history: [],
      },
      isLoading: false,
    };
  });

  it('keeps loading until the first request settles without data', () => {
    mockPromiseResult = {
      result: undefined,
      isLoading: undefined,
    };

    const { rerender } = render(
      <InviteeRewardContent walletAddress="0xwallet" />,
    );

    expect(screen.getByText('referral.reward_history')).toBeTruthy();
    expect(
      screen.getByTestId('reward-summary').getAttribute('data-loading'),
    ).toBe('true');
    expect(
      screen.getByTestId('reward-history-list').getAttribute('data-loading'),
    ).toBe('true');

    mockPromiseResult = {
      result: undefined,
      isLoading: false,
    };
    rerender(<InviteeRewardContent walletAddress="0xwallet" />);

    expect(
      screen.getByTestId('reward-summary').getAttribute('data-loading'),
    ).toBe('false');
    expect(
      screen.getByTestId('reward-history-list').getAttribute('data-loading'),
    ).toBe('false');
    expect(
      screen.getByTestId('reward-history-list').getAttribute('data-count'),
    ).toBe('0');
  });

  it('renders the reward summary and desktop payout history host', () => {
    const { rerender } = render(
      <InviteeRewardContent walletAddress="0xwallet" />,
    );

    expect(screen.getByTestId('reward-summary').textContent).toBe('12:3:USDC');
    expect(screen.getByText('referral.reward_history')).toBeTruthy();
    expect(
      screen.getByTestId('reward-history-list').getAttribute('data-count'),
    ).toBe('0');
    expect(screen.getByTestId('scroll-view')).toBeTruthy();

    mockPromiseResult.result = {
      totalBonus: '12',
      undistributed: '3',
      token: {
        symbol: 'USDC',
        logoURI: '',
      },
      history: [{ date: '2026-09-08', tx: '0xtx', amount: '0.17' }],
    };
    rerender(<InviteeRewardContent walletAddress="0xwallet" isMobile />);

    expect(
      screen.getByTestId('reward-history-list').getAttribute('data-count'),
    ).toBe('1');
    expect(screen.queryByTestId('scroll-view')).toBeNull();
  });

  it('keeps the no-wallet state', () => {
    render(<InviteeRewardContent walletAddress="" />);

    expect(screen.getByText('referral.apply_code_no_wallet')).toBeTruthy();
  });
});
