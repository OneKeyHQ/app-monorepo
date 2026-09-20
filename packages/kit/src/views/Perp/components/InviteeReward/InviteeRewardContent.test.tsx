/** @jest-environment jsdom */
/* eslint-disable import/first */

import type { ReactNode } from 'react';

import { fireEvent, render, screen } from '@testing-library/react';

const mockToOnBoardingPage = jest.fn();
let mockPromiseResult: {
  result?: {
    totalBonus: string;
    undistributed: string;
    token: {
      symbol: string;
      logoURI: string;
      networkId?: string;
    };
    history: {
      date: string;
      tx: string;
      amount: string;
    }[];
  };
  isLoading: boolean;
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
  const Button = ({
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
      { 'data-testid': testID, onClick: onPress },
      children,
    );
  const Empty = ({
    title,
    description,
  }: {
    title?: ReactNode;
    description?: ReactNode;
  }) =>
    React.createElement(
      'div',
      null,
      React.createElement('span', null, title),
      React.createElement('span', null, description),
    );

  const Pressable = ({
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
    Button,
    Divider: Primitive,
    Empty,
    Icon: Primitive,
    NumberSizeableText: Primitive,
    ScrollView: ({ children }: { children?: ReactNode }) =>
      React.createElement('div', { 'data-testid': 'scroll-view' }, children),
    SizableText: Primitive,
    Skeleton: Primitive,
    XStack: Pressable,
    YStack: Primitive,
    useInTabDialog: jest.fn(),
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

jest.mock('@onekeyhq/kit-bg/src/states/jotai/atoms', () => ({
  perpsActiveAccountAtom: {
    get: jest.fn(),
  },
}));

jest.mock('@onekeyhq/shared/src/locale/appLocale', () => ({
  appLocale: {
    intl: {
      formatMessage: ({ id }: { id: string }) => id,
    },
  },
}));

jest.mock('@onekeyhq/kit/src/utils/explorerUtils', () => ({
  openTransactionDetailsUrl: jest.fn(),
}));

jest.mock(
  '@onekeyhq/kit/src/views/Onboarding/hooks/useToOnBoardingPage',
  () => ({
    useToOnBoardingPage: () => mockToOnBoardingPage,
  }),
);

jest.mock('@onekeyhq/kit/src/components/Token', () => ({
  Token: () => <div />,
}));

jest.mock('../../PerpsProviderMirror', () => ({
  PerpsProviderMirror: ({ children }: { children?: ReactNode }) => children,
}));

jest.mock('./components/RewardSummaryCard', () => ({
  RewardSummaryCard: ({
    totalBonus,
    undistributed,
    tokenSymbol,
  }: {
    totalBonus?: string;
    undistributed?: string;
    tokenSymbol?: string;
  }) => (
    <div data-testid="reward-summary">
      {totalBonus}:{undistributed}:{tokenSymbol}
    </div>
  ),
}));

import { InviteeRewardContent } from './InviteeRewardContent';

describe('InviteeRewardContent', () => {
  beforeEach(() => {
    mockToOnBoardingPage.mockReset();
    mockPromiseResult = {
      result: {
        totalBonus: '12',
        undistributed: '3',
        token: {
          symbol: 'USDC',
          logoURI: '',
          networkId: 'evm--42161',
        },
        history: [],
      },
      isLoading: false,
    };
  });

  it('renders the aggregate reward summary and empty payout history', () => {
    render(<InviteeRewardContent walletAddress="0xwallet" />);

    expect(screen.getByTestId('reward-summary').textContent).toBe('12:3:USDC');
    expect(screen.getByText('referral.reward_history')).toBeTruthy();
    expect(screen.getByText('global.no_data')).toBeTruthy();
    expect(screen.getByTestId('scroll-view')).toBeTruthy();
  });

  it('renders payout history on desktop and keeps the mobile page scroll host', () => {
    mockPromiseResult.result = {
      totalBonus: '12',
      undistributed: '3',
      token: {
        symbol: 'USDC',
        logoURI: '',
        networkId: 'evm--42161',
      },
      history: [
        {
          date: '2026-09-08',
          tx: '0x298e9a1234567890abcdef123456788e5941',
          amount: '0.17',
        },
      ],
    };

    const { rerender } = render(
      <InviteeRewardContent walletAddress="0xwallet" />,
    );

    expect(screen.getByText('referral.reward_history')).toBeTruthy();
    expect(screen.getByText('2026-09-08')).toBeTruthy();
    expect(screen.getByText('0x298e9a...8e5941')).toBeTruthy();
    expect(screen.getByTestId('scroll-view')).toBeTruthy();

    rerender(<InviteeRewardContent walletAddress="0xwallet" isMobile />);

    expect(screen.queryByTestId('scroll-view')).toBeNull();
    expect(screen.getByText('referral.reward_history')).toBeTruthy();
  });

  it('keeps the no-wallet state', () => {
    const onBeforeNavigate = jest.fn();

    render(
      <InviteeRewardContent
        walletAddress=""
        onBeforeNavigate={onBeforeNavigate}
      />,
    );

    expect(screen.getByText('referral.apply_code_no_wallet')).toBeTruthy();
    fireEvent.click(screen.getByTestId('perp-to-on-boarding-page-btn'));
    expect(onBeforeNavigate).toHaveBeenCalledTimes(1);
  });
});
