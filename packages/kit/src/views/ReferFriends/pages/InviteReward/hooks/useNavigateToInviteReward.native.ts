import { useCallback } from 'react';

import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import {
  EModalReferFriendsRoutes,
  EModalRoutes,
} from '@onekeyhq/shared/src/routes';

export function useNavigateToInviteReward() {
  const navigation = useAppNavigation();

  return useCallback(() => {
    navigation.pushModal(EModalRoutes.ReferFriendsModal, {
      screen: EModalReferFriendsRoutes.InviteReward,
    });
  }, [navigation]);
}

export function useReplaceToInviteReward() {
  const navigation = useAppNavigation();

  return useCallback(() => {
    navigation.replace(EModalReferFriendsRoutes.InviteReward);
  }, [navigation]);
}
