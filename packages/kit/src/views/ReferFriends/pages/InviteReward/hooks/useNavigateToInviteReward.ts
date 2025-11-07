import { useCallback } from 'react';

import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { ETabReferFriendsRoutes } from '@onekeyhq/shared/src/routes';

export function useNavigateToInviteReward() {
  const navigation = useAppNavigation();

  return useCallback(() => {
    navigation.push(ETabReferFriendsRoutes.TabInviteReward);
  }, [navigation]);
}

export function useReplaceToInviteReward() {
  const navigation = useAppNavigation();

  return useCallback(() => {
    navigation.replace(ETabReferFriendsRoutes.TabInviteReward);
  }, [navigation]);
}
