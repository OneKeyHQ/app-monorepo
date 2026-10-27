import { useCallback, useMemo } from 'react';

import { rootNavigationRef } from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import {
  EModalReferFriendsRoutes,
  EModalRoutes,
  ERootRoutes,
  ETabReferFriendsRoutes,
  ETabRoutes,
} from '@onekeyhq/shared/src/routes';
import type {
  IInviteRewardRouteParams,
  IPerksOpenEntry,
  IReferralPageTab,
} from '@onekeyhq/shared/src/routes';
import { closeExtensionPopupAfterExpandTabOpen } from '@onekeyhq/shared/src/utils/extUtils';
import timerUtils from '@onekeyhq/shared/src/utils/timerUtils';

import { useOneKeyAuth } from '../components/OneKeyAuth/useOneKeyAuth';

import useAppNavigation from './useAppNavigation';

const shouldUseReferralModalNav = platformEnv.isNative;
const shouldOpenReferralInExtensionExpandTab =
  platformEnv.isExtensionUiPopup || platformEnv.isExtensionUiSidePanel;

function openExtensionReferralInExpandTab(path: string, params?: object) {
  return backgroundApiProxy.serviceApp
    .openExtensionExpandTab({
      path,
      params,
    })
    .then(closeExtensionPopupAfterExpandTabOpen);
}

export function useToReferFriendsModalByRootNavigation() {
  return useCallback(async () => {
    const isLogin = await backgroundApiProxy.servicePrime.isLoggedIn();

    if (shouldOpenReferralInExtensionExpandTab) {
      await openExtensionReferralInExpandTab(
        isLogin ? '/refer-friends/invite-reward' : '/refer-friends',
      );
      return;
    }

    if (shouldUseReferralModalNav) {
      const screen = isLogin
        ? EModalReferFriendsRoutes.InviteReward
        : EModalReferFriendsRoutes.ReferAFriend;

      rootNavigationRef.current?.navigate(ERootRoutes.Modal, {
        screen: EModalRoutes.ReferFriendsModal,
        params: {
          screen,
        },
      });
    } else {
      const screen = isLogin
        ? ETabReferFriendsRoutes.TabInviteReward
        : ETabReferFriendsRoutes.TabReferAFriend;

      rootNavigationRef.current?.navigate(
        ERootRoutes.Main,
        {
          screen: ETabRoutes.ReferFriends,
          params: {
            screen,
          },
        },
        {
          pop: true,
        },
      );
    }
  }, []);
}

export function useReplaceToReferFriends() {
  const navigation = useAppNavigation();

  return useCallback(
    async (params?: {
      utmSource?: string;
      code?: string;
      tab?: IReferralPageTab;
      perksEntry?: IPerksOpenEntry;
      /** Skip isLoggedIn check when caller already knows login state */
      isLoggedIn?: boolean;
    }) => {
      const { isLoggedIn: knownLoginState, ...navParams } = params ?? {};
      const isLogin =
        knownLoginState ?? (await backgroundApiProxy.servicePrime.isLoggedIn());

      if (shouldUseReferralModalNav) {
        const screen = isLogin
          ? EModalReferFriendsRoutes.InviteReward
          : EModalReferFriendsRoutes.ReferAFriend;
        navigation.replace(screen, navParams);
      } else {
        const screen = isLogin
          ? ETabReferFriendsRoutes.TabInviteReward
          : ETabReferFriendsRoutes.TabReferAFriend;
        // Use reset instead of replace to clear the navigation stack
        // This prevents the back button from appearing on the root screen
        navigation.reset({
          index: 0,
          routes: [{ name: screen, params: navParams }],
        });
      }
    },
    [navigation],
  );
}

export const useReferFriends = () => {
  const navigation = useAppNavigation();
  const { loginOneKeyId } = useOneKeyAuth();

  const toInviteRewardPage = useCallback(
    async (params?: IInviteRewardRouteParams) => {
      const isLogin = await backgroundApiProxy.servicePrime.isLoggedIn();
      if (isLogin) {
        if (shouldOpenReferralInExtensionExpandTab) {
          await openExtensionReferralInExpandTab(
            '/refer-friends/invite-reward',
            params,
          );
          return;
        }
        if (shouldUseReferralModalNav) {
          navigation.pushModal(EModalRoutes.ReferFriendsModal, {
            screen: EModalReferFriendsRoutes.InviteReward,
            params,
          });
        } else {
          navigation.switchTab(ETabRoutes.ReferFriends);
          await timerUtils.wait(50);
          rootNavigationRef.current?.reset({
            index: 0,
            routes: [{ name: ETabReferFriendsRoutes.TabInviteReward, params }],
          });
        }
      } else {
        void loginOneKeyId({ toOneKeyIdPageOnLoginSuccess: false });
      }
    },
    [loginOneKeyId, navigation],
  );

  const toHardwareSalesRewardPage = useCallback(
    async (params?: { showOrderDetail?: boolean; orderId?: string }) => {
      const isLogin = await backgroundApiProxy.servicePrime.isLoggedIn();
      if (isLogin) {
        if (shouldOpenReferralInExtensionExpandTab) {
          await openExtensionReferralInExpandTab(
            '/refer-friends/hardware-sales-reward',
            params,
          );
          return;
        }
        if (shouldUseReferralModalNav) {
          navigation.pushModal(EModalRoutes.ReferFriendsModal, {
            screen: EModalReferFriendsRoutes.HardwareSalesReward,
            params,
          });
        } else {
          navigation.switchTab(ETabRoutes.ReferFriends);
          await timerUtils.wait(50);
          rootNavigationRef.current?.navigate(
            ETabReferFriendsRoutes.TabHardwareSalesReward,
            params,
          );
        }
      } else {
        void loginOneKeyId({ toOneKeyIdPageOnLoginSuccess: false });
      }
    },
    [loginOneKeyId, navigation],
  );

  const openHardwareSalesOrderDetail = useCallback(
    (orderId: string) =>
      toHardwareSalesRewardPage({ showOrderDetail: true, orderId }),
    [toHardwareSalesRewardPage],
  );

  const toReferFriendsPage = useCallback(
    async (params?: {
      tab?: IReferralPageTab;
      perksEntry?: IPerksOpenEntry;
    }) => {
      // ReferAFriend always redirects logged-in users to InviteReward, so route
      // them there directly to avoid flashing the intro poster first.
      const shouldShowInviteReward =
        await backgroundApiProxy.servicePrime.isLoggedIn();

      if (shouldOpenReferralInExtensionExpandTab) {
        await openExtensionReferralInExpandTab(
          shouldShowInviteReward
            ? '/refer-friends/invite-reward'
            : '/refer-friends',
          params,
        );
        return;
      }

      if (shouldUseReferralModalNav) {
        // Native: use Modal
        navigation.pushModal(EModalRoutes.ReferFriendsModal, {
          screen: shouldShowInviteReward
            ? EModalReferFriendsRoutes.InviteReward
            : EModalReferFriendsRoutes.ReferAFriend,
          params,
        });
      } else {
        // Web / desktop: use Tab
        navigation.switchTab(ETabRoutes.ReferFriends);
        await timerUtils.wait(50);
        rootNavigationRef.current?.reset({
          index: 0,
          routes: [
            {
              name: shouldShowInviteReward
                ? ETabReferFriendsRoutes.TabInviteReward
                : ETabReferFriendsRoutes.TabReferAFriend,
              params,
            },
          ],
        });
      }
    },
    [navigation],
  );

  return useMemo(
    () => ({
      toReferFriendsPage,
      toInviteRewardPage,
      toHardwareSalesRewardPage,
      openHardwareSalesOrderDetail,
    }),
    [
      toReferFriendsPage,
      toInviteRewardPage,
      toHardwareSalesRewardPage,
      openHardwareSalesOrderDetail,
    ],
  );
};

// The activity hub's one referral entry names no tab, so the page reopens
// the tab the user last left: invite for sharing, Perks for rewards.
export function useOpenReferralPage() {
  const { toReferFriendsPage } = useReferFriends();
  return useCallback(() => {
    void toReferFriendsPage({ perksEntry: 'activity_hub' });
  }, [toReferFriendsPage]);
}
