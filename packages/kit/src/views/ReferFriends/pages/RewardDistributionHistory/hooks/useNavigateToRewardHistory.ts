import { useCallback } from 'react';

import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import {
  EModalReferFriendsRoutes,
  EModalRoutes,
} from '@onekeyhq/shared/src/routes';

export function useNavigateToRewardHistory() {
  const navigation = useAppNavigation();

  return useCallback(() => {
    // Native or medium+ screens: use Modal navigation
    navigation.pushModal(EModalRoutes.ReferFriendsModal, {
      screen: EModalReferFriendsRoutes.RewardDistributionHistory,
    });
  }, [navigation]);
}
