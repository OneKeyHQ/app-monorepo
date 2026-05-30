import { CommonActions } from '@react-navigation/native';

import type { IAppNavigation } from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { showReferralBlockingOverlayToast } from '@onekeyhq/kit/src/routes/config/deeplink/referralLandingOverlayGuard';
import appGlobals from '@onekeyhq/shared/src/appGlobals';
import {
  EModalReferFriendsRoutes,
  EModalRoutes,
  ERootRoutes,
  ETabHomeRoutes,
  ETabRoutes,
} from '@onekeyhq/shared/src/routes';

type IReferralNavigationRoute = {
  key?: string;
  name: string;
  params?: unknown;
  state?: IReferralNavigationState;
};

type IReferralNavigationState = {
  index?: number;
  routes: IReferralNavigationRoute[];
  [key: string]: unknown;
};

function buildInvitedByFriendModalParams({
  code,
  page,
}: {
  code: string | undefined;
  page: string | undefined;
}) {
  return {
    screen: EModalReferFriendsRoutes.InvitedByFriend,
    params: {
      code,
      page,
    },
  };
}

function resetReferralLandingHomeRoute(route: IReferralNavigationRoute) {
  if (route.name !== ETabRoutes.Home || !route.state) {
    return route;
  }

  const tabHomeRoute = route.state.routes.find(
    (item) => item.name === ETabHomeRoutes.TabHome,
  );
  if (!tabHomeRoute) {
    return route;
  }

  return {
    ...route,
    state: {
      ...route.state,
      index: 0,
      routes: [tabHomeRoute],
    },
  };
}

function resetReferralLandingMainRoute(route: IReferralNavigationRoute) {
  if (route.name !== ERootRoutes.Main || !route.state) {
    return route;
  }

  return {
    ...route,
    state: {
      ...route.state,
      routes: route.state.routes.map(resetReferralLandingHomeRoute),
    },
  };
}

function openInvitedByFriendModalFromRootNavigation({
  code,
  page,
}: {
  code: string | undefined;
  page: string | undefined;
}) {
  const rootNavigation = appGlobals.$navigationRef?.current;
  const rootState = rootNavigation?.getRootState() as
    | IReferralNavigationState
    | undefined;
  if (!rootNavigation || !rootState) {
    return false;
  }

  const mainRoutes = rootState.routes
    .filter((route) => route.name === ERootRoutes.Main)
    .map(resetReferralLandingMainRoute);
  if (!mainRoutes.length) {
    return false;
  }

  rootNavigation.dispatch(
    CommonActions.reset({
      ...rootState,
      routes: [
        ...mainRoutes,
        {
          name: ERootRoutes.Modal,
          params: {
            screen: EModalRoutes.ReferFriendsModal,
            params: buildInvitedByFriendModalParams({ code, page }),
          },
        },
      ],
      index: mainRoutes.length,
    } as Parameters<typeof CommonActions.reset>[0]),
  );
  return true;
}

export function openReferralInvitedByFriendModalWithGuard({
  code,
  page,
  navigation,
  shouldContinue,
}: {
  code: string | undefined;
  page: string | undefined;
  navigation: IAppNavigation;
  shouldContinue: () => boolean;
}) {
  const openInvitedByFriendModal = () => {
    if (!shouldContinue()) {
      return;
    }
    navigation.pushModal(
      EModalRoutes.ReferFriendsModal,
      buildInvitedByFriendModalParams({ code, page }),
    );
    navigation.reset({
      index: 0,
      routes: [{ name: ETabHomeRoutes.TabHome }],
    });
  };

  if (!shouldContinue()) {
    return true;
  }

  if (
    showReferralBlockingOverlayToast({
      shouldContinue,
      onContinue: ({ shouldContinue: shouldContinueToast }) => {
        if (!shouldContinueToast()) {
          return;
        }
        if (!shouldContinue()) {
          return;
        }
        if (openInvitedByFriendModalFromRootNavigation({ code, page })) {
          return;
        }
        openInvitedByFriendModal();
      },
    })
  ) {
    return true;
  }

  openInvitedByFriendModal();
  return false;
}
