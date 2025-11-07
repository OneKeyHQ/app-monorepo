import { useCallback } from 'react';

import { useMedia } from '@onekeyhq/components';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import {
  EModalReferFriendsRoutes,
  EModalRoutes,
  ETabReferFriendsRoutes,
} from '@onekeyhq/shared/src/routes';

export function useNavigateToReferAFriend() {
  const navigation = useAppNavigation();
  const { gtMd } = useMedia();

  return useCallback(
    (params?: { utmSource?: string; code?: string }) => {
      if (gtMd) {
        // Wide screen: use Tab navigation
        navigation.push(ETabReferFriendsRoutes.TabReferAFriend, params);
      } else {
        // Narrow screen: use Modal navigation
        navigation.pushModal(EModalRoutes.ReferFriendsModal, {
          screen: EModalReferFriendsRoutes.ReferAFriend,
          params,
        });
      }
    },
    [navigation, gtMd],
  );
}

export function useReplaceToReferAFriend() {
  const navigation = useAppNavigation();
  const { gtMd } = useMedia();

  return useCallback(
    (params?: { utmSource?: string; code?: string }) => {
      if (gtMd) {
        // Wide screen: use Tab navigation
        navigation.replace(ETabReferFriendsRoutes.TabReferAFriend, params);
      } else {
        // Narrow screen: use Modal navigation
        navigation.replace(EModalReferFriendsRoutes.ReferAFriend, params);
      }
    },
    [navigation, gtMd],
  );
}
