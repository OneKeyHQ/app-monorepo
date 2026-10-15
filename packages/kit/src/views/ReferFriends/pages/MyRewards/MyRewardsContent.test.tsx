/** @jest-environment jsdom */
/* eslint-disable import/first */

import type { ReactNode } from 'react';

import { fireEvent, render, screen } from '@testing-library/react';

const mockReloadOverview = jest.fn();
let mockActiveAccount: {
  account?: { id: string };
  indexedAccount?: { id: string };
};
let mockEarnAccountResult: {
  result?: { accountId: string; accountAddress: string } | null;
  isLoading: boolean;
};
let mockOverviewResult: {
  result?: Record<
    'perps' | 'swap' | 'earn',
    { status: 'success'; data: unknown } | { status: 'error' }
  >;
  isLoading: boolean;
};

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
      { onClick: onPress, 'data-testid': testID },
      children,
    );

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
    Empty: ({ title }: { title?: ReactNode }) =>
      React.createElement('div', null, title),
    Icon: () => null,
    NumberSizeableText: Primitive,
    SizableText: Primitive,
    Skeleton: () => null,
    Stack: Primitive,
    XStack: Primitive,
    YStack: Primitive,
  };
});

// The account resolver depends on account ids; the overview only on the
// resolved address, so the dependency count tells the two calls apart.
jest.mock('@onekeyhq/kit/src/hooks/usePromiseResult', () => ({
  usePromiseResult: (_fn: unknown, deps: unknown[]) =>
    deps.length === 1
      ? { ...mockOverviewResult, run: mockReloadOverview }
      : mockEarnAccountResult,
}));

jest.mock('@onekeyhq/kit/src/background/instance/backgroundApiProxy', () => ({
  __esModule: true,
  default: {},
}));

jest.mock('@onekeyhq/kit/src/components/AccountSelector', () => ({
  AccountSelectorTriggerHome: () => null,
}));

jest.mock('@onekeyhq/kit/src/hooks/useAppNavigation', () => ({
  __esModule: true,
  default: () => ({ pushModal: jest.fn() }),
}));

jest.mock('@onekeyhq/kit/src/states/jotai/contexts/accountSelector', () => ({
  useActiveAccount: () => ({ activeAccount: mockActiveAccount }),
}));

jest.mock('@onekeyhq/kit/src/components/Token', () => ({
  Token: () => null,
}));

jest.mock('@onekeyhq/kit/src/hooks/useFormatDate', () => ({
  __esModule: true,
  default: () => ({ formatDate: (date: string) => date }),
}));

jest.mock('@onekeyhq/shared/src/utils/openUrlUtils', () => ({
  __esModule: true,
  default: { openUrlExternal: jest.fn() },
}));

jest.mock('@onekeyhq/kit/src/utils/explorerUtils', () => ({
  openTransactionDetailsUrl: jest.fn(),
}));

jest.mock(
  '@onekeyhq/kit/src/views/Staking/components/ProtocolDetails/EarnText',
  () => ({
    EarnText: ({ text }: { text?: { text: string } }) => (
      <div>{text?.text}</div>
    ),
  }),
);

jest.mock('../InviteReward/components/BenefitsTabPlaceholder', () => ({
  BenefitsTabPlaceholder: () => <div data-testid="perks-placeholder" />,
}));

jest.mock('../../components/InviteeRewardNoWallet', () => ({
  InviteeRewardNoWallet: () => <div data-testid="no-wallet" />,
}));

import { MyRewardsContent } from './MyRewardsContent';

describe('MyRewardsContent', () => {
  beforeEach(() => {
    mockReloadOverview.mockReset();
    mockActiveAccount = {
      account: { id: 'hd-1--account' },
      indexedAccount: { id: 'hd-1--0' },
    };
    mockEarnAccountResult = {
      result: { accountId: 'evm-account', accountAddress: '0xabc' },
      isLoading: false,
    };
    mockOverviewResult = {
      result: {
        perps: {
          status: 'success',
          data: {
            totalBonus: '5',
            undistributed: '1',
            token: { symbol: 'USDC', logoURI: '' },
            history: [{ date: '2026-01-10', tx: '0x1', amount: '1' }],
          },
        },
        swap: {
          status: 'success',
          data: {
            totalBonus: '12',
            undistributed: '3',
            token: { symbol: 'USDC' },
            history: [],
          },
        },
        earn: { status: 'error' },
      },
      isLoading: false,
    };
  });

  it('shows onboarding when there is no wallet', () => {
    mockActiveAccount = {};
    render(<MyRewardsContent />);
    expect(screen.getByTestId('no-wallet')).toBeTruthy();
  });

  it('shows the unsupported state when the account has no EVM address', () => {
    mockEarnAccountResult = { result: null, isLoading: false };
    render(<MyRewardsContent />);
    expect(screen.getByText('This account has no EVM address')).toBeTruthy();
  });

  it('summarizes every module and isolates a failing one', () => {
    render(<MyRewardsContent />);
    expect(screen.getByTestId('my-rewards-module-perps').textContent).toContain(
      '5',
    );
    expect(screen.getByTestId('my-rewards-module-swap').textContent).toContain(
      '12',
    );
    expect(screen.getByText('global.perp history')).toBeTruthy();
    expect(screen.getByText('2026-01-10')).toBeTruthy();

    fireEvent.click(screen.getByTestId('my-rewards-module-earn'));
    expect(screen.getByText('Unable to load rewards')).toBeTruthy();
    fireEvent.click(screen.getByTestId('my-rewards-retry'));
    expect(mockReloadOverview).toHaveBeenCalledTimes(1);
  });

  it('falls back to the perks placeholder when no module has rewards', () => {
    const empty = {
      totalBonus: '0',
      undistributed: '0',
      token: { symbol: 'USDC', logoURI: '' },
      history: [],
    };
    mockOverviewResult = {
      result: {
        perps: { status: 'success', data: empty },
        swap: { status: 'success', data: empty },
        earn: {
          status: 'success',
          data: { distributed: [], undistributed: [] },
        },
      },
      isLoading: false,
    };
    render(<MyRewardsContent />);
    expect(screen.getByTestId('perks-placeholder')).toBeTruthy();
    expect(screen.queryByTestId('my-rewards-module-perps')).toBeNull();
  });
});
