import { useCallback } from 'react';

import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { ETabReferFriendsRoutes } from '@onekeyhq/shared/src/routes';

export function useNavigateToReferAFriend() {
  const navigation = useAppNavigation();

  return useCallback(
    (params?: { utmSource?: string; code?: string }) => {
      navigation.push(ETabReferFriendsRoutes.TabReferAFriend, params);
    },
    [navigation],
  );
}

export function useReplaceToReferAFriend() {
  const navigation = useAppNavigation();

  return useCallback(
    (params?: { utmSource?: string; code?: string }) => {
      navigation.replace(ETabReferFriendsRoutes.TabReferAFriend, params);
    },
    [navigation],
  );
}
