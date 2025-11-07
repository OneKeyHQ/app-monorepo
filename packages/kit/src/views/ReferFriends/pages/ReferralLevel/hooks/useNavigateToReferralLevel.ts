import { useCallback } from 'react';

import { useMedia } from '@onekeyhq/components';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import {
  EModalReferFriendsRoutes,
  EModalRoutes,
  ETabReferFriendsRoutes,
} from '@onekeyhq/shared/src/routes';

export function useNavigateToReferralLevel() {
  const navigation = useAppNavigation();
  const { gtMd } = useMedia();

  return useCallback(() => {
    if (gtMd) {
      // Wide screen: use Tab navigation
      navigation.push(ETabReferFriendsRoutes.TabReferralLevel);
    } else {
      // Narrow screen: use Modal navigation
      navigation.pushModal(EModalRoutes.ReferFriendsModal, {
        screen: EModalReferFriendsRoutes.ReferralLevel,
      });
    }
  }, [navigation, gtMd]);
}
