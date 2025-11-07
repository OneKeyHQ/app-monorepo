import { useCallback } from 'react';

import { useMedia } from '@onekeyhq/components';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import {
  EModalReferFriendsRoutes,
  EModalRoutes,
  ETabReferFriendsRoutes,
} from '@onekeyhq/shared/src/routes';

export function useNavigateToRewardHistory() {
  const navigation = useAppNavigation();
  const { gtMd } = useMedia();

  return useCallback(() => {
    if (gtMd) {
      // Wide screen: use Tab navigation
      navigation.push(ETabReferFriendsRoutes.TabRewardDistributionHistory);
    } else {
      // Narrow screen: use Modal navigation
      navigation.pushModal(EModalRoutes.ReferFriendsModal, {
        screen: EModalReferFriendsRoutes.RewardDistributionHistory,
      });
    }
  }, [navigation, gtMd]);
}
