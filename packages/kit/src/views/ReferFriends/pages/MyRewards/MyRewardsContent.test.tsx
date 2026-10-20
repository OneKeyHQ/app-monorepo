/** @jest-environment jsdom */
/* eslint-disable import/first */

import type { ReactNode } from 'react';

import { fireEvent, render, screen } from '@testing-library/react';

const mockReloadOverview = jest.fn();
const mockShowDialog = jest.fn();
const mockCopyText = jest.fn();
let mockIsCompact = false;
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
    Divider: () => null,
    Icon: () => null,
    IconButton: Primitive,
    Popover: ({
      renderTrigger,
      renderContent,
    }: {
      renderTrigger: ReactNode;
      renderContent: ReactNode;
    }) => React.createElement('div', null, renderTrigger, renderContent),
    Illustration: () => null,
    Image: () => null,
    NATIVE_HIT_SLOP: undefined,
    NumberSizeableText: Primitive,
    SizableText: Primitive,
    Skeleton: Object.assign(() => null, {
      HeadingLg: () => null,
      Heading3Xl: () => null,
      BodyMd: () => null,
    }),
    Stack: Primitive,
    XStack: Primitive,
    YStack: Primitive,
    useClipboard: () => ({ copyText: mockCopyText }),
    useInTabDialog: () => ({ show: showDialog }),
    useMedia: () => ({ md: mockIsCompact, gtMd: !mockIsCompact }),
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

jest.mock('@onekeyhq/kit/src/components/Currency', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  return {
    Currency: ({
      children,
      sourceCurrency,
    }: {
      children?: ReactNode;
      sourceCurrency?: string;
    }) =>
      React.createElement(
        'span',
        { 'data-source-currency': sourceCurrency },
        children,
      ),
  };
});

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

jest.mock('./PerksCampaignBanner', () => ({
  PerksCampaignBanner: () => null,
  usePerksBannerItems: () => ({ items: [], isLoading: false }),
}));

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
  INVITE_CARD_BORDER_COLOR: '$neutral4',
  INVITE_POPOVER_PANEL_PROPS: {},
  POINTER_ROW_BLEED_PROPS: {},
  PRESSABLE_SURFACE_PROPS: {},
  useInviteHomeCardStyle: () => ({}),
}));

import { MyRewardsContent } from './MyRewardsContent';

describe('MyRewardsContent', () => {
  beforeEach(() => {
    mockReloadOverview.mockReset();
    mockShowDialog.mockReset();
    mockCopyText.mockReset();
    mockIsCompact = false;
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
    const header = screen.getByTestId('my-rewards-summary-card');
    expect(header.textContent).toContain('referral_perks_no_evm__title');
    // No address to count means no total either.
    expect(header.textContent).toContain('--');
    // The row note and the empty state's title.
    expect(screen.getAllByText('referral_perks_no_evm__title')).toHaveLength(2);
    expect(screen.queryByTestId('my-rewards-copy-address')).toBeNull();
  });

  it('shows the counted address shortened and copies it in full', () => {
    const address = '0x4EF8800000000000000000000000000000A296e';
    mockEarnAccountResult = {
      result: { accountId: 'evm-account', accountAddress: address },
      isLoading: false,
    };
    render(<MyRewardsContent />);
    const copyCell = screen.getByTestId('my-rewards-copy-address');
    expect(copyCell.textContent).toBe('0x4EF8...296e');
    expect(screen.getByTestId('my-rewards-payout-info')).toBeTruthy();

    fireEvent.click(copyCell);
    expect(mockCopyText).toHaveBeenCalledWith(address);
  });

  it('leaves the desktop total unknown while a product failed', () => {
    render(<MyRewardsContent />);
    const summary = screen.getByTestId('my-rewards-summary-card');
    expect(summary.querySelectorAll('[data-source-currency]')).toHaveLength(0);
    expect(summary.textContent).toContain('--');
  });

  it('adds every product into the desktop total and its parts', () => {
    mockOverviewResult = {
      ...mockOverviewResult,
      result: {
        ...mockOverviewResult.result!,
        earn: {
          status: 'success',
          data: { distributed: [], undistributed: [] },
        },
      },
    };
    render(<MyRewardsContent />);
    const figures = Array.from(
      screen
        .getByTestId('my-rewards-summary-card')
        .querySelectorAll('[data-source-currency="usd"]'),
    ).map((node) => node.textContent);
    expect(figures).toEqual(['17', '13', '4']);
  });

  it('shows the total, its parts and the payout address on compact layouts', () => {
    mockIsCompact = true;
    mockOverviewResult = {
      ...mockOverviewResult,
      result: {
        ...mockOverviewResult.result!,
        earn: {
          status: 'success',
          data: { distributed: [], undistributed: [] },
        },
      },
    };
    render(<MyRewardsContent />);
    const summary = screen.getByTestId('my-rewards-summary-card');
    const figures = Array.from(
      summary.querySelectorAll('[data-source-currency="usd"]'),
    ).map((node) => node.textContent);
    expect(figures).toEqual(['17', '13', '4']);
    // The address has its own row, so the info popover leaves it out.
    expect(
      summary.querySelectorAll('[data-testid="my-rewards-copy-address"]'),
    ).toHaveLength(1);
    expect(summary.textContent).toContain('referral_perks_paid_to__title');
  });

  it('splits each product into paid and unpaid and isolates a failure', () => {
    render(<MyRewardsContent />);
    const perps = screen.getByTestId('my-rewards-module-perps');
    expect(perps.textContent).toContain('4');
    expect(perps.textContent).toContain('1');
    expect(screen.getByTestId('my-rewards-copy-address')).toBeTruthy();
    expect(perps.querySelectorAll('[data-source-currency="usd"]')).toHaveLength(
      2,
    );
    const swap = screen.getByTestId('my-rewards-module-swap');
    expect(swap.textContent).toContain('9');
    expect(swap.querySelectorAll('[data-source-currency="usd"]')).toHaveLength(
      2,
    );
    expect(screen.getByTestId('my-rewards-module-earn').textContent).toContain(
      'referral_perks_load_failed__msg',
    );

    fireEvent.click(screen.getByTestId('my-rewards-module-swap'));
    expect(mockShowDialog).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'global.swap' }),
    );

    fireEvent.click(screen.getByTestId('my-rewards-module-earn'));
    expect(mockReloadOverview).toHaveBeenCalledTimes(1);
  });

  it('shows DeFi token amounts as wallet currency', () => {
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
          data: {
            distributed: [{ title: { text: '0.3976 USDC' } }],
            undistributed: [
              { title: { text: '0.02 USDC' } },
              { title: { text: '0.01 USDC' } },
            ],
          },
        },
      },
      isLoading: false,
    };
    render(<MyRewardsContent />);
    const earn = screen.getByTestId('my-rewards-module-earn');
    expect(earn.textContent).toContain('0.3976');
    expect(earn.textContent).toContain('0.03');
    expect(earn.textContent).not.toContain('USDC');
    expect(earn.textContent).not.toContain('more');
    expect(earn.querySelectorAll('[data-source-currency="usd"]')).toHaveLength(
      2,
    );
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
