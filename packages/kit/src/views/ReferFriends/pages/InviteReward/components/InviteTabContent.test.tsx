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
const mockNavigateToRewardHistory = jest.fn();
const mockNavigateToHardwareSalesReward = jest.fn();
const mockNavigateToPerpsReward = jest.fn();
const mockNavigateToSwapReward = jest.fn();
const mockNavigateToEarnReward = jest.fn();
let mockMd = false;

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
      walletsWithStatus: [{ status: 'bindable' }],
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

jest.mock('./InviteReferAnimation', () => ({
  InviteReferAnimation: () => null,
}));
jest.mock('./ReferralLinkDropdown', () => ({
  ReferralLinkDropdown: () => null,
}));
jest.mock('./SuspensionAlert', () => ({
  SuspensionAlert: () => null,
}));
jest.mock('./InviteCodeManager', () => ({
  InviteCodeManager: () => <div data-testid="invite-code-manager" />,
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

function renderTab() {
  return render(
    <InviteTabContent
      summaryInfo={SUMMARY}
      fetchSummaryInfo={jest.fn()}
      levelDetail={undefined}
    />,
  );
}

describe('InviteTabContent entry points', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockMd = false;
  });

  it('copies the invite link and the invite code', () => {
    renderTab();

    fireEvent.click(screen.getByTestId(ReferFriendsTestIDs.copyLinkBtn));
    expect(mockCopyUrl).toHaveBeenCalledWith(SUMMARY.inviteUrl);

    fireEvent.click(screen.getByTestId(ReferFriendsTestIDs.inviteCodeLine));
    expect(mockCopyText).toHaveBeenCalledWith(SUMMARY.inviteCode);
  });

  it('opens invite code management from the code line', () => {
    renderTab();
    expect(screen.queryByTestId('invite-code-manager')).toBeNull();

    fireEvent.click(screen.getByTestId(ReferFriendsTestIDs.inviteManageCodes));
    expect(screen.getByTestId('invite-code-manager')).toBeTruthy();
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

  it('opens the bind referral code dialog', () => {
    renderTab();

    fireEvent.click(screen.getByTestId(ReferFriendsTestIDs.inviteBindRow));
    expect(mockBindWalletInviteCode).toHaveBeenCalledWith(
      expect.objectContaining({ source: 'invite_home' }),
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

  it('explains hardware pending and undistributed rewards', () => {
    renderTab();

    expect(
      screen.getByTestId(`info-${ETranslations.referral_hw_pending_pop_title}`),
    ).toBeTruthy();
    expect(
      screen.getByTestId(
        `info-${ETranslations.referral_hw_undistributed_pop_title}`,
      ),
    ).toBeTruthy();
  });
});
