import { useCallback } from 'react';

import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import {
  EModalReferFriendsRoutes,
  EModalRoutes,
  ETabReferFriendsRoutes,
} from '@onekeyhq/shared/src/routes';

export function useNavigateToReferAFriend() {
  const navigation = useAppNavigation();

  return useCallback(
    (params?: { utmSource?: string; code?: string }) => {
      if (platformEnv.isNative) {
        // Native platform: use Modal navigation
        navigation.pushModal(EModalRoutes.ReferFriendsModal, {
          screen: EModalReferFriendsRoutes.ReferAFriend,
          params,
        });
      } else {
        // Web/Desktop/Extension: use Tab navigation
        navigation.push(ETabReferFriendsRoutes.TabReferAFriend, params);
      }
    },
    [navigation],
  );
}

export function useReplaceToReferAFriend() {
  const navigation = useAppNavigation();

  return useCallback(
    (params?: { utmSource?: string; code?: string }) => {
      if (platformEnv.isNative) {
        // Native platform: use Modal navigation
        navigation.replace(EModalReferFriendsRoutes.ReferAFriend, params);
      } else {
        // Web/Desktop/Extension: use Tab navigation
        navigation.replace(ETabReferFriendsRoutes.TabReferAFriend, params);
      }
    },
    [navigation],
  );
}
