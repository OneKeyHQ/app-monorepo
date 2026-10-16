/** @jest-environment jsdom */
/* eslint-disable import/first */

import type { ReactNode } from 'react';

import { fireEvent, render, screen } from '@testing-library/react';

const mockReloadOverview = jest.fn();
const mockShowDialog = jest.fn();
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

  const showDialog = (props: unknown) => {
    mockShowDialog(props);
  };
  return {
    Dialog: { show: showDialog },
    Icon: () => null,
    Illustration: () => null,
    NumberSizeableText: Primitive,
    SizableText: Primitive,
    Skeleton: () => null,
    Stack: Primitive,
    XStack: Primitive,
    YStack: Primitive,
    useInTabDialog: () => ({ show: showDialog }),
    useMedia: () => ({ md: false, gtMd: true }),
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

jest.mock('@onekeyhq/kit/src/components/ListItem', () => ({
  ListItem: () => null,
}));

jest.mock('@onekeyhq/kit/src/states/jotai/contexts/accountSelector', () => ({
  useActiveAccount: () => ({ activeAccount: mockActiveAccount }),
}));

jest.mock(
  '@onekeyhq/kit/src/views/Earn/components/InviteeReward/EarnInviteeRewardContent',
  () => ({ EarnInviteeRewardContent: () => null }),
);

jest.mock(
  '@onekeyhq/kit/src/views/Perp/components/InviteeReward/InviteeRewardContent',
  () => ({ InviteeRewardContent: () => null }),
);

jest.mock(
  '@onekeyhq/kit/src/views/Swap/components/InviteeReward/SwapInviteeRewardContent',
  () => ({ SwapInviteeRewardContent: () => null }),
);

jest.mock(
  '@onekeyhq/kit/src/views/Staking/components/ProtocolDetails/EarnText',
  () => ({
    EarnText: ({ text }: { text?: { text: string } }) => (
      <div>{text?.text}</div>
    ),
  }),
);

jest.mock('../../components/InviteeRewardNoWallet', () => ({
  InviteeRewardNoWallet: () => <div data-testid="no-wallet" />,
}));

jest.mock('../../components/ReferralCardEmpty', () => ({
  ReferralCardEmpty: ({ title }: { title?: string }) => <div>{title}</div>,
}));

jest.mock('../InviteReward/components/BenefitsTabPlaceholder', () => ({
  BenefitsTabPlaceholder: () => <div data-testid="perks-placeholder" />,
}));

jest.mock('../InviteReward/components/getInviteRewardRows', () => ({
  INVITE_REWARD_SUBJECT_ICON: {
    perps: 'TradeOutline',
    swap: 'SwitchHorOutline',
    defi: 'CoinsOutline',
  },
}));

jest.mock('../InviteReward/components/useInviteCardStyle', () => ({
  COMPACT_ENTRY_TITLE_PROPS: {},
  COMPACT_ROW_BLEED_PROPS: {},
  COMPACT_ROW_ICON_PROPS: {},
  PRESSABLE_SURFACE_PROPS: {},
  useInviteHomeCardStyle: () => ({}),
}));

import { MyRewardsContent } from './MyRewardsContent';

describe('MyRewardsContent', () => {
  beforeEach(() => {
    mockReloadOverview.mockReset();
    mockShowDialog.mockReset();
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
            history: [],
          },
        },
        swap: {
          status: 'success',
          data: {
            totalBonus: '12',
            undistributed: '3',
            token: { symbol: 'USDC', logoURI: '' },
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

  it('splits each product into paid and unpaid and isolates a failure', () => {
    render(<MyRewardsContent />);
    const perps = screen.getByTestId('my-rewards-module-perps').textContent;
    expect(perps).toContain('4');
    expect(perps).toContain('1');
    expect(screen.getByTestId('my-rewards-module-swap').textContent).toContain(
      '9',
    );
    expect(screen.getByTestId('my-rewards-module-earn').textContent).toContain(
      'Unable to load',
    );

    fireEvent.click(screen.getByTestId('my-rewards-module-swap'));
    expect(mockShowDialog).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'global.swap' }),
    );

    fireEvent.click(screen.getByTestId('my-rewards-module-earn'));
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
