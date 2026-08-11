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
    testID,
  }: {
    children?: ReactNode;
    testID?: string;
  }) => React.createElement('button', { 'data-testid': testID }, children);
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

  return {
    Button,
    Empty,
    Icon: Primitive,
    NumberSizeableText: Primitive,
    SizableText: Primitive,
    Skeleton: Primitive,
    XStack: Primitive,
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

jest.mock('@onekeyhq/shared/src/utils/openUrlUtils', () => ({
  __esModule: true,
  default: {
    openUrlExternal: jest.fn(),
  },
}));

jest.mock(
  '@onekeyhq/kit/src/views/Onboarding/hooks/useToOnBoardingPage',
  () => ({
    useToOnBoardingPage: () => jest.fn(),
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

  it('renders only the aggregate reward summary', () => {
    render(<InviteeRewardContent walletAddress="0xwallet" />);

    expect(screen.getByTestId('reward-summary').textContent).toBe('12:3:USDC');
    expect(screen.queryByText('referral.reward_history')).toBeNull();
    expect(screen.queryByText('0xtransa...action')).toBeNull();
    expect(screen.queryByTestId('scroll-view')).toBeNull();
  });

  it('keeps the no-wallet state', () => {
    render(<InviteeRewardContent walletAddress="" />);

    expect(screen.getByText('referral.apply_code_no_wallet')).toBeTruthy();
    expect(screen.getByTestId('perp-to-on-boarding-page-btn')).toBeTruthy();
  });
});
