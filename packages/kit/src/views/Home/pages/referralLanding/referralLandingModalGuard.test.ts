import type { IAppNavigation } from '@onekeyhq/kit/src/hooks/useAppNavigation';
import {
  type IReferralBlockingOverlayContinueParams,
  showReferralBlockingOverlayToast,
} from '@onekeyhq/kit/src/routes/config/deeplink/referralLandingOverlayGuard';
import {
  EModalReferFriendsRoutes,
  EModalRoutes,
  ETabHomeRoutes,
} from '@onekeyhq/shared/src/routes';

import { openReferralInvitedByFriendModalWithGuard } from './referralLandingModalGuard';

jest.mock(
  '@onekeyhq/kit/src/routes/config/deeplink/referralLandingOverlayGuard',
  () => ({
    showReferralBlockingOverlayToast: jest.fn(),
  }),
);

const mockedShowReferralBlockingOverlayToast =
  showReferralBlockingOverlayToast as jest.MockedFunction<
    typeof showReferralBlockingOverlayToast
  >;

type IReferralModalNavigationMock = Pick<IAppNavigation, 'pushModal' | 'reset'>;

function createNavigation(): IReferralModalNavigationMock {
  return {
    pushModal: jest.fn(),
    reset: jest.fn(),
  };
}

function asAppNavigation(navigation: IReferralModalNavigationMock) {
  return navigation as IAppNavigation;
}

describe('openReferralInvitedByFriendModalWithGuard', () => {
  beforeEach(() => {
    mockedShowReferralBlockingOverlayToast.mockReset();
  });

  it('opens the invitation modal immediately when no overlay blocks it', () => {
    mockedShowReferralBlockingOverlayToast.mockReturnValue(false);
    const navigation = createNavigation();

    const blocked = openReferralInvitedByFriendModalWithGuard({
      code: 'R7EKUT',
      page: 'perps',
      navigation: asAppNavigation(navigation),
      shouldContinue: () => true,
    });

    expect(blocked).toBe(false);
    expect(navigation.pushModal).toHaveBeenCalledWith(
      EModalRoutes.ReferFriendsModal,
      {
        screen: EModalReferFriendsRoutes.InvitedByFriend,
        params: {
          code: 'R7EKUT',
          page: 'perps',
        },
      },
    );
    expect(navigation.reset).toHaveBeenCalledWith({
      index: 0,
      routes: [{ name: ETabHomeRoutes.TabHome }],
    });
  });

  it('waits for the toast action before opening the invitation modal', async () => {
    let continueBinding:
      | ((
          params: IReferralBlockingOverlayContinueParams,
        ) => void | Promise<void>)
      | undefined;
    mockedShowReferralBlockingOverlayToast.mockImplementation(
      ({ onContinue }) => {
        continueBinding = onContinue;
        return true;
      },
    );
    const navigation = createNavigation();

    const blocked = openReferralInvitedByFriendModalWithGuard({
      code: 'R7EKUT',
      page: 'perps',
      navigation: asAppNavigation(navigation),
      shouldContinue: () => true,
    });

    expect(blocked).toBe(true);
    expect(navigation.pushModal).not.toHaveBeenCalled();
    expect(navigation.reset).not.toHaveBeenCalled();
    const toastGuardParams =
      mockedShowReferralBlockingOverlayToast.mock.calls[0]?.[0];
    expect(toastGuardParams?.shouldContinue?.()).toBe(true);

    await continueBinding?.({ shouldContinue: () => true });

    expect(navigation.pushModal).toHaveBeenCalledWith(
      EModalRoutes.ReferFriendsModal,
      {
        screen: EModalReferFriendsRoutes.InvitedByFriend,
        params: {
          code: 'R7EKUT',
          page: 'perps',
        },
      },
    );
    expect(navigation.reset).toHaveBeenCalledWith({
      index: 0,
      routes: [{ name: ETabHomeRoutes.TabHome }],
    });
  });

  it('does not open the invitation modal after unmount', () => {
    mockedShowReferralBlockingOverlayToast.mockReturnValue(false);
    const navigation = createNavigation();

    const blocked = openReferralInvitedByFriendModalWithGuard({
      code: 'R7EKUT',
      page: 'perps',
      navigation: asAppNavigation(navigation),
      shouldContinue: () => false,
    });

    expect(blocked).toBe(true);
    expect(mockedShowReferralBlockingOverlayToast).not.toHaveBeenCalled();
    expect(navigation.pushModal).not.toHaveBeenCalled();
    expect(navigation.reset).not.toHaveBeenCalled();
  });

  it.each([
    {
      name: 'unmounted before the toast action continues',
      shouldContinueModal: () => false,
      shouldContinueToast: () => true,
    },
    {
      name: 'the referral request is stale',
      shouldContinueModal: () => true,
      shouldContinueToast: () => false,
    },
  ])(
    'does not open the invitation modal when $name',
    async ({ shouldContinueModal, shouldContinueToast }) => {
      let continueBinding:
        | ((
            params: IReferralBlockingOverlayContinueParams,
          ) => void | Promise<void>)
        | undefined;
      mockedShowReferralBlockingOverlayToast.mockImplementation(
        ({ onContinue }) => {
          continueBinding = onContinue;
          return true;
        },
      );
      const navigation = createNavigation();

      openReferralInvitedByFriendModalWithGuard({
        code: 'R7EKUT',
        page: 'perps',
        navigation: asAppNavigation(navigation),
        shouldContinue: shouldContinueModal,
      });

      await continueBinding?.({ shouldContinue: shouldContinueToast });

      expect(navigation.pushModal).not.toHaveBeenCalled();
      expect(navigation.reset).not.toHaveBeenCalled();
    },
  );
});
