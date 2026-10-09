/**
 * @jest-environment jsdom
 */

import type { ReactNode } from 'react';

import { fireEvent, render, screen } from '@testing-library/react';

import { ReferFriendsTestIDs } from '@onekeyhq/kit/src/views/ReferFriends/testIDs';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import type { IInviteSummary } from '@onekeyhq/shared/src/referralCode/type';

import { InviteTabContent } from './InviteTabContent';

// Parity guard for the invite tab redesign: every entry point the previous
// invite page exposed must still be reachable and wired to the same action.

const mockCopyText = jest.fn();
const mockCopyUrl = jest.fn();
const mockBindWalletInviteCode = jest.fn();
const mockNavigateToYourReferred = jest.fn();
const mockNavigateToInviteCodes = jest.fn();
const mockNavigateToEditAddress = jest.fn();
const mockNavigateToRewardHistory = jest.fn();
const mockNavigateToHardwareSalesReward = jest.fn();
const mockNavigateToPerpsReward = jest.fn();
const mockNavigateToSwapReward = jest.fn();
const mockNavigateToEarnReward = jest.fn();
let mockMd = false;

const mockHeroImageProps: Array<{
  controlRef?: unknown;
  preloadOtherStep?: boolean;
}> = [];

let mockWalletsWithStatus: Array<{ status: string }> | undefined = [
  { status: 'bindable' },
];

jest.mock('@onekeyhq/components', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  const createComponent = (): unknown =>
    new Proxy(
      ({
        children,
        testID,
        onPress,
      }: {
        children?: ReactNode;
        testID?: string;
        onPress?: (e: { stopPropagation: () => void }) => void;
      }) =>
        React.createElement(
          'div',
          {
            'data-testid': testID,
            onClick: onPress
              ? (e: { stopPropagation: () => void }) => onPress(e)
              : undefined,
          },
          children,
        ),
      {
        // Static members such as Badge.Text or Toast.success.
        get: (target, key) =>
          typeof key === 'string' && /^[A-Z]/.test(key) && !(key in target)
            ? createComponent()
            : target[key as 'name'],
      },
    );
  const hooks: Record<string, unknown> = {
    useMedia: () => ({ md: mockMd, gtMd: !mockMd }),
    useClipboard: () => ({ copyText: mockCopyText, copyUrl: mockCopyUrl }),
  };
  return new Proxy(
    {},
    {
      get: (_target, key: string) =>
        key === '__esModule' ? false : (hooks[key] ?? createComponent()),
    },
  );
});

jest.mock(
  '@onekeyhq/kit/src/views/ReferFriends/pages/ReferAFriend/components/InviteCodeStepImage',
  () => ({
    InviteCodeStepImage: (props: (typeof mockHeroImageProps)[number]) => {
      mockHeroImageProps.push(props);
      return null;
    },
  }),
);

jest.mock('@onekeyhq/kit/src/components/NetworkAvatar', () => ({
  NetworkAvatar: ({ networkId }: { networkId: string }) => (
    <div data-testid={`network-avatar-${networkId}`} />
  ),
}));

jest.mock('@onekeyhq/kit/src/states/jotai/contexts/accountSelector', () => ({
  useActiveAccount: () => ({
    activeAccount: { wallet: { id: 'hd-1' } },
  }),
}));

jest.mock('react-intl', () => ({
  useIntl: () => ({
    locale: 'en-US',
    formatMessage: ({ id }: { id: string }) => id,
  }),
}));

jest.mock('@onekeyhq/kit/src/background/instance/backgroundApiProxy', () => ({
  __esModule: true,
  default: {},
}));

jest.mock('@onekeyhq/shared/src/logger/logger', () => ({
  defaultLogger: {
    referral: {
      page: {
        copyReferralCode: jest.fn(),
        shareReferralLink: jest.fn(),
        inviteBindRowShown: jest.fn(),
      },
    },
  },
}));

jest.mock('@onekeyhq/kit/src/components/ListItem', () => ({
  ListItem: ({
    testID,
    title,
    subtitle,
    children,
    onPress,
  }: {
    testID?: string;
    title?: string;
    subtitle?: ReactNode;
    children?: ReactNode;
    onPress?: () => void;
  }) => (
    <button type="button" data-testid={testID} onClick={onPress}>
      {title}
      {subtitle}
      {children}
    </button>
  ),
}));

jest.mock('@onekeyhq/kit/src/components/Currency', () => ({
  Currency: ({ children }: { children?: ReactNode }) => <span>{children}</span>,
}));

jest.mock('@onekeyhq/kit/src/hooks/useFormatDate', () => ({
  __esModule: true,
  default: () => ({ format: (value: string) => value }),
}));

jest.mock('@onekeyhq/kit/src/components/InfoIcon', () => ({
  InfoIcon: ({ tooltip }: { tooltip: { title: string } }) => (
    <span data-testid={`info-${tooltip.title}`} />
  ),
}));

jest.mock(
  '@onekeyhq/kit/src/views/ReferFriends/hooks/useWalletBoundReferralCode',
  () => ({
    useFetchWalletsWithBoundStatus: () => ({
      walletsWithStatus: mockWalletsWithStatus,
      refreshWalletsWithStatus: jest.fn(),
    }),
    useWalletBoundReferralCode: () => ({
      bindWalletInviteCode: mockBindWalletInviteCode,
    }),
  }),
);

jest.mock(
  '@onekeyhq/kit/src/views/ReferFriends/pages/YourReferred/hooks',
  () => ({ useNavigateToYourReferred: () => mockNavigateToYourReferred }),
);
jest.mock(
  '@onekeyhq/kit/src/views/ReferFriends/pages/RewardDistributionHistory/hooks/useNavigateToRewardHistory',
  () => ({ useNavigateToRewardHistory: () => mockNavigateToRewardHistory }),
);
jest.mock(
  '@onekeyhq/kit/src/views/ReferFriends/pages/HardwareSalesReward/hooks/useNavigateToHardwareSalesReward',
  () => ({
    useNavigateToHardwareSalesReward: () => mockNavigateToHardwareSalesReward,
  }),
);
jest.mock(
  '@onekeyhq/kit/src/views/ReferFriends/pages/PerpsReward/hooks/useNavigateToPerpsReward',
  () => ({ useNavigateToPerpsReward: () => mockNavigateToPerpsReward }),
);
jest.mock(
  '@onekeyhq/kit/src/views/ReferFriends/pages/SwapReward/hooks/useNavigateToSwapReward',
  () => ({ useNavigateToSwapReward: () => mockNavigateToSwapReward }),
);
jest.mock(
  '@onekeyhq/kit/src/views/ReferFriends/pages/EarnReward/hooks/useNavigateToEarnReward',
  () => ({ useNavigateToEarnReward: () => mockNavigateToEarnReward }),
);

jest.mock('./ReferralLinkDropdown', () => ({
  ReferralLinkDropdown: () => null,
}));
jest.mock('./SuspensionAlert', () => ({
  SuspensionAlert: () => null,
}));
jest.mock(
  '@onekeyhq/kit/src/views/ReferFriends/pages/InviteCodes/hooks/useNavigateToInviteCodes',
  () => ({ useNavigateToInviteCodes: () => mockNavigateToInviteCodes }),
);

jest.mock(
  '@onekeyhq/kit/src/views/ReferFriends/pages/ReferralLevel/hooks/useNavigateToReferralLevel',
  () => ({ useNavigateToReferralLevel: () => jest.fn() }),
);

jest.mock(
  '@onekeyhq/kit/src/views/ReferFriends/pages/EditAddress/hooks/useNavigateToEditAddress',
  () => ({ useNavigateToEditAddress: () => mockNavigateToEditAddress }),
);

jest.mock('./useInviteCardStyle', () => ({
  useInviteHomeCardStyle: () => ({}),
}));

const TOKEN = {
  networkId: 'evm--1',
  address: '0xusdc',
  logoURI: '',
  name: 'USD Coin',
  symbol: 'USDC',
};
const REWARD = [
  { token: TOKEN, amount: '10', fiatValue: '10', usdValue: '10' },
];

const SUMMARY = {
  inviteUrl: 'https://onekey.so/r/ABC123',
  inviteCode: 'ABC123',
  withdrawAddresses: [],
  enabledNetworks: ['evm--1'],
  rebateConfig: {
    level: 1,
    emoji: '',
    icon: '',
    rebate: 10,
    discount: 5,
    threshold: 0,
    thresholdFiatValue: '0',
    labelKey: '',
    label: 'Gold',
  },
  rebateLevels: [],
  cumulativeRewards: {
    distributed: '20',
    undistributed: '10',
    pending: '0',
    nextDistribution: '2026-11-01',
    token: TOKEN,
  },
  HardwareSales: {
    title: '',
    description: '',
    available: REWARD,
    pending: REWARD,
    nextStage: { isEnd: false, percent: '', amount: '', label: '' },
  },
  Perp: { title: '', description: '', available: REWARD },
  Onchain: { title: 'DeFi', description: '', available: REWARD, swap: REWARD },
} as unknown as IInviteSummary;

function renderTab(summaryInfo: IInviteSummary = SUMMARY) {
  return render(
    <InviteTabContent
      summaryInfo={summaryInfo}
      fetchSummaryInfo={jest.fn()}
      levelDetail={undefined}
    />,
  );
}

describe('InviteTabContent entry points', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockMd = false;
    mockWalletsWithStatus = [{ status: 'bindable' }];
  });

  it('copies the invite link and the invite code', () => {
    renderTab();

    fireEvent.click(screen.getByTestId(ReferFriendsTestIDs.copyLinkBtn));
    expect(mockCopyUrl).toHaveBeenCalledWith(SUMMARY.inviteUrl);

    fireEvent.click(screen.getByTestId(ReferFriendsTestIDs.inviteCodeLine));
    expect(mockCopyText).toHaveBeenCalledWith(SUMMARY.inviteCode);
  });

  it('opens the invite codes page from the code line', () => {
    renderTab();

    fireEvent.click(screen.getByTestId(ReferFriendsTestIDs.inviteManageCodes));
    expect(mockNavigateToInviteCodes).toHaveBeenCalled();
  });

  it.each([false, true])(
    'keeps referral list and reward history entries (compact: %s)',
    (md) => {
      mockMd = md;
      renderTab();

      fireEvent.click(
        screen.getByTestId(ReferFriendsTestIDs.inviteYourReferred),
      );
      expect(mockNavigateToYourReferred).toHaveBeenCalled();

      fireEvent.click(
        screen.getByTestId(ReferFriendsTestIDs.inviteRewardHistory),
      );
      expect(mockNavigateToRewardHistory).toHaveBeenCalled();
    },
  );

  it('leaves the withdraw address to the reward history page', () => {
    renderTab();

    expect(
      screen.queryByTestId(ReferFriendsTestIDs.inviteWithdrawAddressRow),
    ).toBeNull();
  });

  it('edits the payout address straight from the desktop earnings card', () => {
    renderTab();

    fireEvent.click(
      screen.getByTestId(ReferFriendsTestIDs.invitePayoutAddress),
    );
    expect(mockNavigateToEditAddress).toHaveBeenCalledWith(
      expect.objectContaining({ enabledNetworks: SUMMARY.enabledNetworks }),
    );
    expect(mockNavigateToRewardHistory).not.toHaveBeenCalled();
  });

  it.each([
    { withdrawAddresses: [] },
    { withdrawAddresses: [{ networkId: 'evm--1', address: '0xpayout' }] },
  ])(
    'always shows the compact payout address (%#)',
    ({ withdrawAddresses }) => {
      mockMd = true;
      renderTab({ ...SUMMARY, withdrawAddresses } as unknown as IInviteSummary);

      expect(
        screen.getByTestId(ReferFriendsTestIDs.invitePayoutAddress),
      ).toBeTruthy();
      // A set address names the chain it is paid on.
      expect(Boolean(screen.queryByTestId('network-avatar-evm--1'))).toBe(
        withdrawAddresses.length > 0,
      );
    },
  );

  it('opens the compact page on the invite hero with the level', () => {
    mockMd = true;
    renderTab();

    expect(screen.getByText(ETranslations.referral_home__title)).toBeTruthy();
    expect(
      screen.getByTestId(ReferFriendsTestIDs.inviteLevelPill),
    ).toBeTruthy();
  });

  it('hands the hero animation control to the page', () => {
    mockMd = true;
    mockHeroImageProps.length = 0;
    const controlRef = { current: null };
    render(
      <InviteTabContent
        summaryInfo={SUMMARY}
        fetchSummaryInfo={jest.fn()}
        levelDetail={undefined}
        heroAnimationControlRef={controlRef}
      />,
    );

    const props = mockHeroImageProps.at(-1);
    expect(props?.controlRef).toBe(controlRef);
    // The home shows one animation, so it skips the intro's other one.
    expect(props?.preloadOtherStep).toBe(false);
  });

  it.each([
    { wallets: undefined, shown: false },
    { wallets: [{ status: 'expired' }], shown: false },
    { wallets: [{ status: 'bindable' }], shown: true },
  ])(
    'shows the bind prompt only when a wallet can bind (%#)',
    ({ wallets, shown }) => {
      mockWalletsWithStatus = wallets;
      renderTab();

      expect(
        Boolean(screen.queryByTestId(ReferFriendsTestIDs.inviteBindRow)),
      ).toBe(shown);
    },
  );

  it('opens the bind referral code dialog', () => {
    renderTab();

    fireEvent.click(screen.getByTestId(ReferFriendsTestIDs.inviteBindRow));
    expect(mockBindWalletInviteCode).toHaveBeenCalledWith(
      expect.objectContaining({
        source: 'invite_home',
        preferredWalletId: 'hd-1',
      }),
    );
  });

  it.each([false, true])(
    'routes every reward row to its detail page (compact: %s)',
    (md) => {
      mockMd = md;
      renderTab();

      fireEvent.click(screen.getByText(ETranslations.referral_referred_type_3));
      fireEvent.click(screen.getByText(ETranslations.referral_perps));
      fireEvent.click(
        screen.getByText(ETranslations.swap_referral_link__title),
      );
      fireEvent.click(screen.getByText(ETranslations.referral_referred_type_2));

      expect(mockNavigateToHardwareSalesReward).toHaveBeenCalledTimes(1);
      expect(mockNavigateToPerpsReward).toHaveBeenCalledTimes(1);
      expect(mockNavigateToSwapReward).toHaveBeenCalledTimes(1);
      expect(mockNavigateToEarnReward).toHaveBeenCalledWith('DeFi');
    },
  );

  it('shows one empty state instead of empty product entries', () => {
    renderTab({
      ...SUMMARY,
      HardwareSales: { ...SUMMARY.HardwareSales, available: [], pending: [] },
      Perp: { ...SUMMARY.Perp, available: [] },
      Onchain: { ...SUMMARY.Onchain, available: [], swap: [] },
    } as unknown as IInviteSummary);

    expect(screen.queryByText(ETranslations.referral_perps)).toBeNull();
  });

  it('explains hardware pending rewards without repeating the payout date', () => {
    renderTab();

    expect(
      screen.getByTestId(`info-${ETranslations.referral_hw_pending_pop_title}`),
    ).toBeTruthy();
    expect(
      screen.queryByTestId(
        `info-${ETranslations.referral_hw_undistributed_pop_title}`,
      ),
    ).toBeNull();
  });
});
