import { useCallback } from 'react';

import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import {
  EModalReferFriendsRoutes,
  EModalRoutes,
  ETabReferFriendsRoutes,
} from '@onekeyhq/shared/src/routes';

/**
 * Unified hook to navigate to ReferFriends feature
 * - Checks login status before navigation
 * - Routes to InviteReward if logged in, ReferAFriend if not
 * - Handles both Native (Modal) and Web/Desktop/Extension (Tab) platforms
 */
export function useNavigateToReferFriends() {
  const navigation = useAppNavigation();

  return useCallback(
    async (params?: { utmSource?: string; code?: string }) => {
      const isLogin = await backgroundApiProxy.servicePrime.isLoggedIn();

      if (platformEnv.isNative) {
        // Native platform: use Modal navigation
        const screen = isLogin
          ? EModalReferFriendsRoutes.InviteReward
          : EModalReferFriendsRoutes.ReferAFriend;

        navigation.pushModal(EModalRoutes.ReferFriendsModal, {
          screen,
          params,
        });
      } else {
        // Web/Desktop/Extension: use Tab navigation
        const screen = isLogin
          ? ETabReferFriendsRoutes.TabInviteReward
          : ETabReferFriendsRoutes.TabReferAFriend;

        navigation.push(screen, params);
      }
    },
    [navigation],
  );
}

/**
 * Replace version of unified navigation to ReferFriends
 * - Uses replace instead of push to prevent back navigation
 */
export function useReplaceToReferFriends() {
  const navigation = useAppNavigation();

  return useCallback(
    async (params?: { utmSource?: string; code?: string }) => {
      const isLogin = await backgroundApiProxy.servicePrime.isLoggedIn();

      if (platformEnv.isNative) {
        // Native platform: use Modal navigation
        const screen = isLogin
          ? EModalReferFriendsRoutes.InviteReward
          : EModalReferFriendsRoutes.ReferAFriend;

        navigation.replace(screen, params);
      } else {
        // Web/Desktop/Extension: use Tab navigation
        const screen = isLogin
          ? ETabReferFriendsRoutes.TabInviteReward
          : ETabReferFriendsRoutes.TabReferAFriend;

        navigation.replace(screen, params);
      }
    },
    [navigation],
  );
}
