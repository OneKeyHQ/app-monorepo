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
  ready?: boolean;
};
let mockEarnAccountResult: {
  result?: { accountId: string; accountAddress: string } | null;
  isLoading: boolean;
};
let mockEarnAccountIdentity:
  | { accountId?: string; indexedAccountId?: string }
  | undefined;
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
  usePromiseResult: (_fn: unknown, deps: unknown[]) => {
    if (deps.length !== 1) {
      const raw = mockEarnAccountResult.isLoading
        ? undefined
        : mockEarnAccountResult.result;
      return {
        isLoading: mockEarnAccountResult.isLoading,
        run: jest.fn(),
        result:
          raw === undefined
            ? undefined
            : {
                accountId:
                  mockEarnAccountIdentity?.accountId ??
                  mockActiveAccount.account?.id,
                indexedAccountId:
                  mockEarnAccountIdentity?.indexedAccountId ??
                  mockActiveAccount.indexedAccount?.id,
                earnAccount: raw,
              },
      };
    }
    const address = mockEarnAccountResult.result?.accountAddress;
    return {
      isLoading: mockOverviewResult.isLoading,
      run: mockReloadOverview,
      result:
        mockOverviewResult.result && address
          ? { address, overview: mockOverviewResult.result }
          : undefined,
    };
  },
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

jest.mock('@onekeyhq/kit/src/components/Token', () => ({
  Token: () => null,
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

const mockPerksHomeShown = jest.fn();
const mockPerksProductOpened = jest.fn();
const mockPerksAddressCopied = jest.fn();
jest.mock('@onekeyhq/shared/src/logger/logger', () => ({
  defaultLogger: {
    referral: {
      page: {
        perksHomeShown: (params: unknown) => {
          mockPerksHomeShown(params);
        },
        perksProductOpened: (params: unknown) => {
          mockPerksProductOpened(params);
        },
        perksAddressCopied: () => {
          mockPerksAddressCopied();
        },
      },
    },
  },
}));

import { MyRewardsContent } from './MyRewardsContent';

describe('MyRewardsContent', () => {
  beforeEach(() => {
    mockReloadOverview.mockReset();
    mockShowDialog.mockReset();
    mockCopyText.mockReset();
    mockPerksHomeShown.mockReset();
    mockPerksProductOpened.mockReset();
    mockPerksAddressCopied.mockReset();
    mockIsCompact = false;
    mockActiveAccount = {
      account: { id: 'hd-1--account' },
      indexedAccount: { id: 'hd-1--0' },
    };
    mockEarnAccountIdentity = undefined;
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
    expect(mockPerksHomeShown).toHaveBeenCalledWith({
      status: 'no_wallet',
      entry: 'route',
    });
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
    expect(mockPerksHomeShown).toHaveBeenCalledWith({
      status: 'no_evm',
      entry: 'route',
    });
  });

  it.each([false, true])(
    'explains when unpaid rewards are paid at the Unpaid figure (compact: %s)',
    (compact) => {
      mockIsCompact = compact;
      mockEarnAccountResult = {
        result: { accountId: 'evm-account', accountAddress: '0xabc' },
        isLoading: false,
      };
      render(<MyRewardsContent />);
      const unpaidInfo = screen.getByTestId('my-rewards-unpaid-info');
      expect(unpaidInfo).toBeTruthy();
      // The schedule is told once, at the Unpaid figure, not by the address.
      expect(
        screen.getAllByText('referral_perks_payout_schedule__desc'),
      ).toHaveLength(1);
    },
  );

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
    expect(mockPerksAddressCopied).toHaveBeenCalledTimes(1);
    expect(mockPerksHomeShown).toHaveBeenCalledWith({
      status: 'partial',
      entry: 'route',
    });
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
    expect(figures).toEqual(['18', '14', '4']);
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
    expect(figures).toEqual(['18', '14', '4']);
    // The address has its own row, so the info popover leaves it out.
    expect(
      summary.querySelectorAll('[data-testid="my-rewards-copy-address"]'),
    ).toHaveLength(1);
    expect(summary.textContent).toContain('referral_perks_paid_to__title');
  });

  it('keeps a non-USDC Perps amount in token units and leaves the total unknown', () => {
    mockOverviewResult = {
      ...mockOverviewResult,
      result: {
        ...mockOverviewResult.result!,
        perps: {
          status: 'success',
          data: {
            totalBonus: '2',
            undistributed: '0.5',
            token: { symbol: 'ETH', logoURI: '' },
            history: [],
          },
        },
        earn: {
          status: 'success',
          data: { distributed: [], undistributed: [] },
        },
      },
    };
    render(<MyRewardsContent />);
    const perps = screen.getByTestId('my-rewards-module-perps');
    expect(perps.textContent).toContain('2 ETH');
    expect(perps.textContent).toContain('0.5 ETH');
    expect(perps.querySelectorAll('[data-source-currency="usd"]')).toHaveLength(
      0,
    );
    const swap = screen.getByTestId('my-rewards-module-swap');
    expect(swap.querySelectorAll('[data-source-currency="usd"]')).toHaveLength(
      2,
    );
    expect(screen.getByTestId('my-rewards-summary-card').textContent).toContain(
      '--',
    );
  });

  it('splits each product into paid and unpaid and isolates a failure', () => {
    render(<MyRewardsContent />);
    const perps = screen.getByTestId('my-rewards-module-perps');
    expect(
      Array.from(perps.querySelectorAll('[data-source-currency="usd"]')).map(
        (node) => node.textContent,
      ),
    ).toEqual(['5', '1']);
    expect(screen.getByTestId('my-rewards-copy-address')).toBeTruthy();
    expect(perps.querySelectorAll('[data-source-currency="usd"]')).toHaveLength(
      2,
    );
    const swap = screen.getByTestId('my-rewards-module-swap');
    expect(
      Array.from(swap.querySelectorAll('[data-source-currency="usd"]')).map(
        (node) => node.textContent,
      ),
    ).toEqual(['9', '3']);
    expect(swap.querySelectorAll('[data-source-currency="usd"]')).toHaveLength(
      2,
    );
    expect(screen.getByTestId('my-rewards-module-earn').textContent).toContain(
      'referral_perks_load_failed__msg',
    );

    fireEvent.click(screen.getByTestId('my-rewards-module-swap'));
    expect(mockPerksProductOpened).toHaveBeenCalledWith({ product: 'swap' });
    expect(mockShowDialog).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'global.swap' }),
    );

    fireEvent.click(screen.getByTestId('my-rewards-module-earn'));
    expect(mockPerksProductOpened).toHaveBeenCalledTimes(1);
    expect(mockReloadOverview).toHaveBeenCalledTimes(1);
    expect(mockPerksHomeShown).toHaveBeenCalledWith({
      status: 'partial',
      entry: 'route',
    });
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
            distributed: [
              {
                title: { text: '0.3976 USDC' },
                token: { symbol: 'USDC' },
              },
            ],
            undistributed: [
              {
                title: { text: '0.02 USDC' },
                token: { symbol: 'USDC' },
              },
              {
                title: { text: '0.01 USDC' },
                token: { symbol: 'USDC' },
              },
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

  it('keeps a non-USDC Earn amount in token units and leaves the total unknown', () => {
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
            distributed: [
              { title: { text: '0.5 ETH' }, token: { symbol: 'ETH' } },
            ],
            undistributed: [],
          },
        },
      },
      isLoading: false,
    };
    render(<MyRewardsContent />);
    const earn = screen.getByTestId('my-rewards-module-earn');
    expect(earn.textContent).toContain('0.5 ETH');
    expect(earn.querySelectorAll('[data-source-currency="usd"]')).toHaveLength(
      0,
    );
    expect(screen.getByTestId('my-rewards-summary-card').textContent).toContain(
      '--',
    );
  });

  it('does not add mixed Earn tokens together', () => {
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
            distributed: [
              { title: { text: '0.02 USDC' }, token: { symbol: 'USDC' } },
              { title: { text: '0.5 ETH' }, token: { symbol: 'ETH' } },
            ],
            undistributed: [],
          },
        },
      },
      isLoading: false,
    };
    render(<MyRewardsContent />);
    const earn = screen.getByTestId('my-rewards-module-earn');
    expect(earn.textContent).toContain('0.02 USDC');
    expect(earn.textContent).toContain('referral_perks_more_tokens__desc');
    expect(earn.querySelectorAll('[data-source-currency="usd"]')).toHaveLength(
      0,
    );
    expect(screen.getByTestId('my-rewards-summary-card').textContent).toContain(
      '--',
    );
  });

  it('adds mixed stablecoin Earn rewards into the dollar total', () => {
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
            distributed: [
              { title: { text: '0.25 USDC' }, token: { symbol: 'USDC' } },
            ],
            undistributed: [
              { title: { text: '0.5 USDC' }, token: { symbol: 'USDC' } },
              { title: { text: '0.25 DAI' }, token: { symbol: 'DAI' } },
              { title: { text: '1 USDT' }, token: { symbol: 'USDT' } },
            ],
          },
        },
      },
      isLoading: false,
    };
    render(<MyRewardsContent />);
    const earn = screen.getByTestId('my-rewards-module-earn');
    expect(earn.textContent).not.toContain('referral_perks_more_tokens__desc');
    const figures = Array.from(
      screen
        .getByTestId('my-rewards-summary-card')
        .querySelectorAll('[data-source-currency="usd"]'),
    ).map((node) => node.textContent);
    expect(figures).toEqual(['2', '0.25', '1.75']);
  });

  it('counts each address once when the wallet switches away and back', () => {
    const { rerender } = render(<MyRewardsContent />);
    expect(mockPerksHomeShown).toHaveBeenCalledTimes(1);

    mockActiveAccount = {
      account: { id: 'hd-2' },
      indexedAccount: { id: 'hd-2--0' },
    };
    mockEarnAccountResult = {
      result: { accountId: 'evm-2', accountAddress: '0xbbb' },
      isLoading: false,
    };
    rerender(<MyRewardsContent />);
    expect(mockPerksHomeShown).toHaveBeenCalledTimes(2);

    mockActiveAccount = {
      account: { id: 'hd-1--account' },
      indexedAccount: { id: 'hd-1--0' },
    };
    mockEarnAccountResult = {
      result: { accountId: 'evm-account', accountAddress: '0xabc' },
      isLoading: false,
    };
    rerender(<MyRewardsContent />);
    expect(mockPerksHomeShown).toHaveBeenCalledTimes(2);
  });

  it('hides the previous account while the next one is still resolving', () => {
    const { rerender } = render(<MyRewardsContent />);
    expect(screen.getByTestId('my-rewards-copy-address')).toBeTruthy();

    mockActiveAccount = {
      account: { id: 'hd-2' },
      indexedAccount: { id: 'hd-2--0' },
    };
    mockEarnAccountIdentity = {
      accountId: 'hd-1--account',
      indexedAccountId: 'hd-1--0',
    };
    rerender(<MyRewardsContent />);
    expect(screen.queryByTestId('my-rewards-copy-address')).toBeNull();
    expect(
      screen.getByTestId('my-rewards-module-perps').textContent,
    ).not.toContain('4');
    expect(mockPerksHomeShown).toHaveBeenCalledTimes(1);
  });

  it('waits for saved accounts before showing the empty-wallet state', () => {
    mockActiveAccount = { ready: false };
    mockEarnAccountResult = { result: null, isLoading: true };
    const { rerender } = render(<MyRewardsContent />);
    expect(screen.queryByTestId('no-wallet')).toBeNull();
    expect(screen.getByTestId('my-rewards-summary-card')).toBeTruthy();
    expect(mockPerksHomeShown).not.toHaveBeenCalled();

    mockActiveAccount = { ready: true };
    rerender(<MyRewardsContent />);
    expect(screen.getByTestId('no-wallet')).toBeTruthy();
    expect(mockPerksHomeShown).toHaveBeenCalledWith({
      status: 'no_wallet',
      entry: 'route',
    });
  });

  it('names a payout token only when every product pays that same token', () => {
    const usdc = {
      totalBonus: '1',
      undistributed: '0',
      token: { symbol: 'USDC', networkId: 'evm--1', logoURI: '' },
      history: [],
    };
    mockOverviewResult = {
      result: {
        perps: { status: 'success', data: usdc },
        swap: { status: 'success', data: usdc },
        earn: {
          status: 'success',
          data: {
            distributed: [
              {
                title: { text: '0.2 USDC' },
                token: { symbol: 'USDC', networkId: 'evm--1' },
              },
            ],
            undistributed: [],
          },
        },
      },
      isLoading: false,
    };
    const { rerender } = render(<MyRewardsContent />);
    expect(screen.getByTestId('my-rewards-summary-card').textContent).toMatch(
      /referral_perks_paid_in/,
    );

    mockOverviewResult = {
      ...mockOverviewResult,
      result: {
        ...mockOverviewResult.result!,
        earn: {
          status: 'success',
          data: {
            distributed: [
              {
                title: { text: '0.5 ETH' },
                token: { symbol: 'ETH', networkId: 'evm--1' },
              },
            ],
            undistributed: [],
          },
        },
      },
    };
    rerender(<MyRewardsContent />);
    const summary = screen.getByTestId('my-rewards-summary-card').textContent;
    expect(summary).toContain('referral_perks_paid_to_address__desc');
    expect(summary).not.toContain('referral_perks_paid_in__desc');
    expect(summary).not.toContain('referral_perks_paid_in_network__desc');
  });

  it('does not name a payout token when one product has no symbol', () => {
    const usdc = {
      totalBonus: '1',
      undistributed: '0',
      token: { symbol: 'USDC', networkId: 'evm--1', logoURI: '' },
      history: [],
    };
    mockOverviewResult = {
      result: {
        perps: { status: 'success', data: usdc },
        swap: {
          status: 'success',
          data: {
            totalBonus: '1',
            undistributed: '0',
            token: { logoURI: '' },
            history: [],
          },
        },
        earn: {
          status: 'success',
          data: { distributed: [], undistributed: [] },
        },
      },
      isLoading: false,
    };
    render(<MyRewardsContent />);
    const summary = screen.getByTestId('my-rewards-summary-card').textContent;
    expect(summary).toContain('referral_perks_paid_to_address__desc');
    expect(summary).not.toContain('referral_perks_paid_in__desc');
    expect(summary).not.toContain('referral_perks_paid_in_network__desc');
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
    expect(mockPerksHomeShown).toHaveBeenCalledWith({
      status: 'empty',
      entry: 'route',
    });
  });

  it('keeps an unpaid Perps reward out of the empty state', () => {
    const empty = {
      totalBonus: '0',
      undistributed: '0',
      token: { symbol: 'USDC', logoURI: '' },
      history: [],
    };
    mockOverviewResult = {
      result: {
        perps: {
          status: 'success',
          data: { ...empty, undistributed: '1' },
        },
        swap: { status: 'success', data: empty },
        earn: {
          status: 'success',
          data: { distributed: [], undistributed: [] },
        },
      },
      isLoading: false,
    };
    render(<MyRewardsContent />);
    expect(screen.queryByTestId('perks-placeholder')).toBeNull();
    const perps = screen.getByTestId('my-rewards-module-perps');
    expect(
      Array.from(perps.querySelectorAll('[data-source-currency="usd"]')).map(
        (node) => node.textContent,
      ),
    ).toEqual(['1']);
    expect(mockPerksHomeShown).toHaveBeenCalledWith({
      status: 'has_rewards',
      entry: 'route',
    });
  });
});
