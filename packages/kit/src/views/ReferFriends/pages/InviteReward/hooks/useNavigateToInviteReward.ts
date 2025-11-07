import { useCallback } from 'react';

import { useMedia } from '@onekeyhq/components';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import {
  EModalReferFriendsRoutes,
  EModalRoutes,
  ETabReferFriendsRoutes,
} from '@onekeyhq/shared/src/routes';

export function useNavigateToInviteReward() {
  const navigation = useAppNavigation();
  const { gtMd } = useMedia();

  return useCallback(() => {
    if (gtMd) {
      // Wide screen: use Tab navigation
      navigation.push(ETabReferFriendsRoutes.TabInviteReward);
    } else {
      // Narrow screen: use Modal navigation
      navigation.pushModal(EModalRoutes.ReferFriendsModal, {
        screen: EModalReferFriendsRoutes.InviteReward,
      });
    }
  }, [navigation, gtMd]);
}

export function useReplaceToInviteReward() {
  const navigation = useAppNavigation();
  const { gtMd } = useMedia();

  return useCallback(() => {
    if (gtMd) {
      // Wide screen: use Tab navigation
      navigation.replace(ETabReferFriendsRoutes.TabInviteReward);
    } else {
      // Narrow screen: use Modal navigation
      navigation.replace(EModalReferFriendsRoutes.InviteReward);
    }
  }, [navigation, gtMd]);
}
