/** @jest-environment jsdom */
/* eslint-disable import/first */

import type { ReactNode } from 'react';

import { fireEvent, render, screen, waitFor } from '@testing-library/react';

const mockRun = jest.fn();
const mockToOnBoardingPage = jest.fn();
let mockPromiseResult: {
  result?:
    | {
        status: 'success';
        data: {
          totalBonus: string;
          undistributed: string;
          token: {
            symbol: string;
          };
          history: {
            date: string;
            tx: string;
            amount: string;
            token: {
              networkId: string;
              address: string;
              logoURI: string;
              name: string;
              symbol: string;
            };
          }[];
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
      { onClick: onPress, 'data-testid': testID },
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

  return {
    Button,
    Empty,
    Icon: Primitive,
    NumberSizeableText: Primitive,
    SizableText: Primitive,
    Skeleton: Primitive,
    XStack: Primitive,
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
      getReferralCodeWalletInfo: jest.fn(),
      getSwapInviteeRewards: jest.fn(),
    },
  },
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

jest.mock('@onekeyhq/kit/src/hooks/useFormatDate', () => ({
  __esModule: true,
  default: () => ({ formatDate: (date: string) => date }),
}));

jest.mock('@onekeyhq/kit/src/utils/explorerUtils', () => ({
  openTransactionDetailsUrl: jest.fn(),
}));

jest.mock('@onekeyhq/kit/src/components/InfoIcon', () => ({
  InfoIcon: () => <div data-testid="reward-summary-info" />,
}));

import { SwapInviteeRewardContent } from './SwapInviteeRewardContent';

describe('SwapInviteeRewardContent', () => {
  beforeEach(() => {
    mockRun.mockReset();
    mockToOnBoardingPage.mockReset();
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

  it('renders only the aggregate reward summary', () => {
    render(
      <SwapInviteeRewardContent
        accountId="hd-1--account"
        currentEvmAddress="0xcurrent"
      />,
    );

    expect(screen.getByText('9')).toBeTruthy();
    expect(screen.getByText('3')).toBeTruthy();
    expect(screen.queryByText('12')).toBeNull();
    expect(screen.queryByText('referral.reward_history')).toBeNull();
    expect(screen.queryByText('0xtransa...action')).toBeNull();
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

    render(
      <SwapInviteeRewardContent
        accountId="hd-1--account"
        currentEvmAddress="0xcurrent"
      />,
    );

    expect(screen.getByText('0')).toBeTruthy();
    expect(screen.getAllByText('0.46')).toHaveLength(1);
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

    render(
      <SwapInviteeRewardContent
        accountId="hd-1--account"
        currentEvmAddress="0xcurrent"
      />,
    );

    expect(screen.getAllByText('0.46')).toHaveLength(1);
    expect(screen.queryByText('0')).toBeNull();
  });

  it('keeps the no-wallet state', () => {
    render(<SwapInviteeRewardContent />);

    expect(screen.getByText('referral.apply_code_no_wallet')).toBeTruthy();
    expect(screen.getByTestId('swap-invitee-reward-onboarding')).toBeTruthy();
  });

  it('dismisses the host overlay before opening onboarding', async () => {
    let resolveClose: (() => void) | undefined;
    const onBeforeNavigate = jest.fn(
      () =>
        new Promise<void>((resolve) => {
          resolveClose = resolve;
        }),
    );

    render(<SwapInviteeRewardContent onBeforeNavigate={onBeforeNavigate} />);
    fireEvent.click(screen.getByTestId('swap-invitee-reward-onboarding'));

    expect(onBeforeNavigate).toHaveBeenCalledTimes(1);
    expect(mockToOnBoardingPage).not.toHaveBeenCalled();

    resolveClose?.();
    await waitFor(() => expect(mockToOnBoardingPage).toHaveBeenCalledTimes(1));
  });

  it('keeps the unsupported-wallet state', () => {
    mockPromiseResult.result = { status: 'unsupported' };

    render(<SwapInviteeRewardContent accountId="hd-1--account" />);

    expect(screen.getByText('perps.account_not_support')).toBeTruthy();
  });

  it('keeps the retry action for request errors', () => {
    mockPromiseResult.result = { status: 'error' };

    render(<SwapInviteeRewardContent accountId="hd-1--account" />);
    fireEvent.click(screen.getByTestId('swap-invitee-reward-retry'));

    expect(mockRun).toHaveBeenCalledTimes(1);
  });
});
