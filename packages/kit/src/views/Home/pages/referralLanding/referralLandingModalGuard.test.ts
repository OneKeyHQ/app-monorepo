import type { IAppNavigation } from '@onekeyhq/kit/src/hooks/useAppNavigation';
import {
  type IReferralBlockingOverlayContinueParams,
  showReferralBlockingOverlayToast,
} from '@onekeyhq/kit/src/routes/config/deeplink/referralLandingOverlayGuard';
import appGlobals from '@onekeyhq/shared/src/appGlobals';
import {
  EModalReferFriendsRoutes,
  EModalRoutes,
  ERootRoutes,
  ETabHomeRoutes,
  ETabRoutes,
} from '@onekeyhq/shared/src/routes';

import { openReferralInvitedByFriendModalWithGuard } from './referralLandingModalGuard';

jest.mock(
  '@onekeyhq/kit/src/routes/config/deeplink/referralLandingOverlayGuard',
  () => ({
    showReferralBlockingOverlayToast: jest.fn(),
  }),
);

jest.mock('@react-navigation/native', () => ({
  CommonActions: {
    reset: jest.fn((payload) => ({
      payload,
      type: 'RESET',
    })),
  },
}));

const mockedShowReferralBlockingOverlayToast =
  showReferralBlockingOverlayToast as jest.MockedFunction<
    typeof showReferralBlockingOverlayToast
  >;

type IReferralModalNavigationMock = Pick<IAppNavigation, 'pushModal' | 'reset'>;
type IRootNavigationRouteMock = {
  key?: string;
  name: string;
  params?: Record<string, unknown>;
  state?: IRootNavigationStateMock;
};
type IRootNavigationStateMock = {
  key: string;
  type: string;
  index: number;
  routeNames: string[];
  routes: IRootNavigationRouteMock[];
  stale: false;
};
type IRootNavigationRefMock = {
  current: {
    dispatch: jest.Mock;
    getRootState: jest.MockedFunction<() => IRootNavigationStateMock>;
  };
};
type IResetActionMock = {
  type: string;
  payload?: {
    index?: number;
    routes?: IRootNavigationRouteMock[];
  };
};

function createNavigation(): IReferralModalNavigationMock {
  return {
    pushModal: jest.fn(),
    reset: jest.fn(),
  };
}

function asAppNavigation(navigation: IReferralModalNavigationMock) {
  return navigation as IAppNavigation;
}

function createRootNavigationRef(
  rootState: IRootNavigationStateMock,
): IRootNavigationRefMock {
  return {
    current: {
      dispatch: jest.fn(),
      getRootState: jest.fn(() => rootState),
    },
  };
}

function createRootStateWithReferralLanding(): IRootNavigationStateMock {
  return {
    key: 'root-stack',
    type: 'stack',
    index: 0,
    routeNames: [ERootRoutes.Main, ERootRoutes.Modal],
    stale: false,
    routes: [
      {
        key: 'main-route',
        name: ERootRoutes.Main,
        state: {
          key: 'tab-state',
          type: 'tab',
          index: 1,
          routeNames: [ETabRoutes.Home, ETabRoutes.Perp],
          stale: false,
          routes: [
            {
              key: 'home-tab',
              name: ETabRoutes.Home,
              state: {
                key: 'home-stack',
                type: 'stack',
                index: 1,
                routeNames: [
                  ETabHomeRoutes.TabHome,
                  ETabHomeRoutes.TabHomeReferralLanding,
                ],
                stale: false,
                routes: [
                  {
                    key: 'tab-home',
                    name: ETabHomeRoutes.TabHome,
                  },
                  {
                    key: 'referral-landing',
                    name: ETabHomeRoutes.TabHomeReferralLanding,
                    params: {
                      code: 'R7EKUT',
                      page: 'perps',
                    },
                  },
                ],
              },
            },
            {
              key: 'perp-tab',
              name: ETabRoutes.Perp,
            },
          ],
        },
      },
    ],
  };
}

describe('openReferralInvitedByFriendModalWithGuard', () => {
  const originalNavigationRef = appGlobals.$navigationRef;

  beforeEach(() => {
    appGlobals.$navigationRef =
      undefined as unknown as typeof appGlobals.$navigationRef;
    mockedShowReferralBlockingOverlayToast.mockReset();
  });

  afterEach(() => {
    appGlobals.$navigationRef = originalNavigationRef;
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

  it('uses root navigation after closing overlays instead of stale local navigation', async () => {
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
    const staleNavigation = createNavigation();
    const rootNavigationRef = createRootNavigationRef(
      createRootStateWithReferralLanding(),
    );
    appGlobals.$navigationRef =
      rootNavigationRef as unknown as typeof appGlobals.$navigationRef;

    const blocked = openReferralInvitedByFriendModalWithGuard({
      code: 'R7EKUT',
      page: 'perps',
      navigation: asAppNavigation(staleNavigation),
      shouldContinue: () => true,
    });

    expect(blocked).toBe(true);
    expect(staleNavigation.pushModal).not.toHaveBeenCalled();
    expect(staleNavigation.reset).not.toHaveBeenCalled();

    await continueBinding?.({ shouldContinue: () => true });

    expect(staleNavigation.pushModal).not.toHaveBeenCalled();
    expect(staleNavigation.reset).not.toHaveBeenCalled();
    expect(rootNavigationRef.current.dispatch).toHaveBeenCalledTimes(1);

    const resetAction = rootNavigationRef.current.dispatch.mock
      .calls[0]?.[0] as IResetActionMock;
    expect(resetAction?.type).toBe('RESET');
    expect(resetAction?.payload?.index).toBe(1);
    expect(resetAction?.payload?.routes?.[1]).toEqual({
      name: ERootRoutes.Modal,
      params: {
        screen: EModalRoutes.ReferFriendsModal,
        params: {
          screen: EModalReferFriendsRoutes.InvitedByFriend,
          params: {
            code: 'R7EKUT',
            page: 'perps',
          },
        },
      },
    });
    const homeRoute = resetAction?.payload?.routes?.[0].state?.routes.find(
      (route) => route.name === ETabRoutes.Home,
    );
    expect(homeRoute?.state?.index).toBe(0);
    expect(homeRoute?.state?.routes).toEqual([
      {
        key: 'tab-home',
        name: ETabHomeRoutes.TabHome,
      },
    ]);
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
