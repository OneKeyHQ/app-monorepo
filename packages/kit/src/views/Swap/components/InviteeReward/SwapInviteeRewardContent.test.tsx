/** @jest-environment jsdom */
/* eslint-disable import/first */

import type { ReactNode } from 'react';

import { fireEvent, render, screen } from '@testing-library/react';

const mockRun = jest.fn();
let mockPromiseResult: {
  result?:
    | {
        status: 'success';
        data: {
          totalBonus: string;
          undistributed: string;
          token: { symbol: string };
          history: { date: string; tx: string; amount: string }[];
        };
      }
    | { status: 'unsupported' }
    | { status: 'error' };
  isLoading: boolean;
  run: jest.Mock;
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
    Button: ({
      children,
      onPress,
      testID,
    }: {
      children?: ReactNode;
      onPress?: () => void;
      testID?: string;
    }) =>
      React.createElement(
        'button',
        { onClick: onPress, 'data-testid': testID },
        children,
      ),
    Divider: Primitive,
    Empty: ({ title }: { title?: ReactNode }) =>
      React.createElement('div', null, title),
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
      getSwapInviteeRewards: jest.fn(),
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
    distributedBonus,
    undistributed,
    tokenSymbol,
  }: {
    distributedBonus?: string;
    undistributed?: string;
    tokenSymbol?: string;
  }) => (
    <div data-testid="reward-summary">
      {distributedBonus}:{undistributed}:{tokenSymbol}
    </div>
  ),
}));

jest.mock('./components/RewardHistoryList', () => ({
  RewardHistoryList: ({ history }: { history?: unknown[] }) => (
    <div
      data-testid="reward-history-list"
      data-count={String(history?.length ?? 0)}
    />
  ),
}));

import { SwapInviteeRewardContent } from './SwapInviteeRewardContent';

function renderContent({ isMobile }: { isMobile?: boolean } = {}) {
  return render(
    <SwapInviteeRewardContent
      accountId="hd-1--account"
      currentEvmAddress="0xcurrent"
      isMobile={isMobile}
    />,
  );
}

describe('SwapInviteeRewardContent', () => {
  beforeEach(() => {
    mockRun.mockReset();
    mockPromiseResult = {
      result: {
        status: 'success',
        data: {
          totalBonus: '12',
          undistributed: '3',
          token: { symbol: 'USDC' },
          history: [],
        },
      },
      isLoading: false,
      run: mockRun,
    };
  });

  it('renders distributed rewards, empty history, and the desktop scroll host', () => {
    const { rerender } = renderContent();

    expect(screen.getByTestId('reward-summary').textContent).toBe('9:3:USDC');
    expect(screen.getByText('referral.reward_history')).toBeTruthy();
    expect(
      screen.getByTestId('reward-history-list').getAttribute('data-count'),
    ).toBe('0');
    expect(screen.getByTestId('scroll-view')).toBeTruthy();

    mockPromiseResult.result = {
      status: 'success',
      data: {
        totalBonus: '12',
        undistributed: '3',
        token: { symbol: 'USDC' },
        history: [{ date: '2026-09-08', tx: '0xtx', amount: '0.17' }],
      },
    };
    rerender(
      <SwapInviteeRewardContent
        accountId="hd-1--account"
        currentEvmAddress="0xcurrent"
        isMobile
      />,
    );

    expect(
      screen.getByTestId('reward-history-list').getAttribute('data-count'),
    ).toBe('1');
    expect(screen.queryByTestId('scroll-view')).toBeNull();
  });

  it('does not treat fully undistributed rewards as distributed', () => {
    mockPromiseResult.result = {
      status: 'success',
      data: {
        totalBonus: '0.46',
        undistributed: '0.46',
        token: { symbol: 'USDC' },
        history: [],
      },
    };

    renderContent();

    expect(screen.getByTestId('reward-summary').textContent).toBe(
      '0:0.46:USDC',
    );
  });

  it('shows only the total bonus when no rewards are undistributed', () => {
    mockPromiseResult.result = {
      status: 'success',
      data: {
        totalBonus: '0.46',
        undistributed: '0',
        token: { symbol: 'USDC' },
        history: [],
      },
    };

    renderContent();

    expect(screen.getByTestId('reward-summary').textContent).toBe(
      '0.46:0:USDC',
    );
  });

  it('shows the no-wallet empty state without an EVM address', () => {
    render(<SwapInviteeRewardContent accountId="watching--btc--bc1qwatch" />);

    expect(screen.getByText('referral.apply_code_no_wallet')).toBeTruthy();
    expect(screen.queryByText('perps.account_not_support')).toBeNull();
  });

  it('keeps the retry action for request errors', () => {
    mockPromiseResult.result = { status: 'error' };

    renderContent();
    fireEvent.click(screen.getByTestId('swap-invitee-reward-retry'));

    expect(mockRun).toHaveBeenCalledTimes(1);
  });
});
