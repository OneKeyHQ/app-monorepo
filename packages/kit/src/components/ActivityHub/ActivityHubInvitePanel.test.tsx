/** @jest-environment jsdom */
/* eslint-disable import/first */

import type { ReactNode } from 'react';

import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';

const mockGetSummaryInfo = jest.fn<Promise<{ inviteCode: string }>, []>();
const mockGetCachedMyReferralCode = jest.fn<Promise<string>, []>();
const mockCopyCode = jest.fn<void, [string]>();
const mockCopyLink = jest.fn<void, [string]>();
let mockIsLoggedIn = true;

jest.mock('react-intl', () => ({
  useIntl: () => ({
    formatMessage: ({ id }: { id: string }) => id,
  }),
}));

jest.mock('@onekeyhq/components', () => {
  const { useDeferredPromise } = jest.requireActual<
    typeof import('../../../../components/src/hooks/useDeferredPromise')
  >('../../../../components/src/hooks/useDeferredPromise');
  const Primitive = ({
    children,
    testID,
    onPress,
    disabled,
  }: {
    children?: ReactNode;
    testID?: string;
    onPress?: () => void;
    disabled?: boolean;
  }) =>
    onPress ? (
      <button
        type="button"
        data-testid={testID}
        onClick={onPress}
        disabled={disabled}
      >
        {children}
      </button>
    ) : (
      <div data-testid={testID}>{children}</div>
    );

  return {
    Button: Primitive,
    Divider: Primitive,
    Icon: Primitive,
    SizableText: Primitive,
    Skeleton: () => <span data-testid="loading-skeleton" />,
    XStack: Primitive,
    YStack: Primitive,
    getCurrentVisibilityState: () => true,
    onVisibilityStateChange: () => () => {},
    useDeferredPromise,
    useNetInfo: () => ({ isRawInternetReachable: true }),
  };
});

jest.mock('@onekeyhq/kit/src/hooks/useRouteIsFocused', () => ({
  useRouteIsFocusedWhenEnabled: () => true,
}));

jest.mock('@onekeyhq/shared/src/platformEnv', () => ({
  __esModule: true,
  default: { isNative: false },
}));

jest.mock('@onekeyhq/kit/src/background/instance/backgroundApiProxy', () => ({
  __esModule: true,
  default: {
    serviceReferralCode: {
      getCachedMyReferralCode: () => mockGetCachedMyReferralCode(),
      getSummaryInfo: () => mockGetSummaryInfo(),
    },
  },
}));

jest.mock('@onekeyhq/kit-bg/src/states/jotai/atoms/prime', () => ({
  usePrimePersistAtom: () => [
    { isLoggedIn: mockIsLoggedIn, isLoggedInOnServer: mockIsLoggedIn },
  ],
}));

jest.mock(
  '@onekeyhq/kit/src/views/ReferFriends/pages/InviteReward/components/shared/useReferralWebAppUrl',
  () => ({ useReferralWebAppUrl: () => 'https://app.onekey.so' }),
);

jest.mock(
  '@onekeyhq/kit/src/views/ReferFriends/pages/InviteReward/referralTabCopy',
  () => ({ useReferralTabCopy: () => ({ perksIntro: 'Perks intro' }) }),
);

jest.mock(
  '@onekeyhq/kit/src/views/ReferFriends/pages/InviteReward/components/useInviteCardStyle',
  () => ({
    INVITE_CARD_BORDER_COLOR: '$borderSubdued',
    POINTER_ROW_BLEED_PROPS: {},
    PRESSABLE_SURFACE_PROPS: {},
  }),
);

jest.mock(
  '@onekeyhq/kit/src/views/ReferFriends/pages/InviteReward/components/ReferralCodeCard/hooks/useReferralCodeCard',
  () => ({
    useReferralCodeCard: ({
      inviteCode,
      inviteUrl,
    }: {
      inviteCode: string;
      inviteUrl: string;
    }) => ({
      inviteCodeUrl: inviteUrl,
      handleCopy: () => mockCopyCode(inviteCode),
      copyLink: () => mockCopyLink(inviteUrl),
    }),
  }),
);

jest.mock('@onekeyhq/shared/src/logger/logger', () => ({
  defaultLogger: {
    referral: {
      activityHub: { activityHubActionPressed: jest.fn() },
    },
  },
}));

import { ETranslations } from '@onekeyhq/shared/src/locale';

import { ActivityHubInvitePanel } from './ActivityHubInvitePanel';

describe('ActivityHubInvitePanel', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockIsLoggedIn = true;
    mockGetCachedMyReferralCode.mockReset().mockResolvedValue('OLD');
    mockGetSummaryInfo.mockReset().mockResolvedValue({ inviteCode: 'NEW' });
  });

  it('displays and copies the refreshed code instead of the stale cache', async () => {
    render(<ActivityHubInvitePanel source="Swap" onOpenReferral={jest.fn()} />);

    await waitFor(() =>
      expect(
        screen.getByTestId('activity-hub-copy-code').textContent,
      ).toContain('NEW'),
    );
    fireEvent.click(screen.getByTestId('activity-hub-copy-code'));
    fireEvent.click(screen.getByTestId('activity-hub-copy-link'));
    expect(mockCopyCode).toHaveBeenCalledWith('NEW');
    expect(mockCopyLink).toHaveBeenCalledWith(
      'https://app.onekey.so/r/NEW/app/swap',
    );
  });

  it('recovers from a failed first request through the retry button', async () => {
    mockGetCachedMyReferralCode.mockResolvedValue('');
    mockGetSummaryInfo.mockRejectedValueOnce(new Error('Offline'));
    render(<ActivityHubInvitePanel source="Swap" onOpenReferral={jest.fn()} />);

    fireEvent.click(await screen.findByTestId('activity-hub-retry'));

    await waitFor(() =>
      expect(
        screen.getByTestId('activity-hub-copy-code').textContent,
      ).toContain('NEW'),
    );
    expect(mockGetSummaryInfo).toHaveBeenCalledTimes(2);
    expect(screen.queryByTestId('activity-hub-retry')).toBeNull();
    expect(screen.queryAllByTestId('loading-skeleton')).toHaveLength(0);
    expect(
      screen.getByTestId('activity-hub-copy-link').hasAttribute('disabled'),
    ).toBe(false);
  });

  it('displays and copies the cached code when the summary request fails', async () => {
    mockGetSummaryInfo.mockRejectedValueOnce(new Error('Offline'));
    render(<ActivityHubInvitePanel source="Swap" onOpenReferral={jest.fn()} />);

    await waitFor(() =>
      expect(
        screen.getByTestId('activity-hub-copy-code').textContent,
      ).toContain('OLD'),
    );
    expect(screen.queryByTestId('activity-hub-retry')).toBeNull();
    fireEvent.click(screen.getByTestId('activity-hub-copy-code'));
    fireEvent.click(screen.getByTestId('activity-hub-copy-link'));
    expect(mockCopyCode).toHaveBeenCalledWith('OLD');
    expect(mockCopyLink).toHaveBeenCalledWith(
      'https://app.onekey.so/r/OLD/app/swap',
    );
    expect(mockGetSummaryInfo).toHaveBeenCalledTimes(1);
  });

  it('falls back to the cached code after a five-second summary timeout', async () => {
    jest.useFakeTimers();
    try {
      mockGetSummaryInfo.mockReturnValueOnce(new Promise(() => {}));
      render(
        <ActivityHubInvitePanel source="Swap" onOpenReferral={jest.fn()} />,
      );

      await act(async () => {
        jest.advanceTimersByTime(5000);
      });

      expect(
        screen.getByTestId('activity-hub-copy-code').textContent,
      ).toContain('OLD');
      expect(screen.queryByTestId('activity-hub-retry')).toBeNull();
      expect(mockGetSummaryInfo).toHaveBeenCalledTimes(1);
    } finally {
      jest.useRealTimers();
    }
  });

  it('opens the referral intro without fetching a code when signed out', async () => {
    mockIsLoggedIn = false;
    const onOpenReferral = jest.fn();
    await act(async () => {
      render(
        <ActivityHubInvitePanel
          source="Swap"
          onOpenReferral={onOpenReferral}
        />,
      );
    });

    fireEvent.click(screen.getByText(ETranslations.global_join));

    expect(onOpenReferral).toHaveBeenCalledWith('invite');
    expect(mockGetSummaryInfo).not.toHaveBeenCalled();
  });
});
