import { useCallback } from 'react';

import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import {
  ETabReferFriendsRoutes,
  ETabRoutes,
} from '@onekeyhq/shared/src/routes';

export function useNavigateToPerpsReward() {
  const navigation = useAppNavigation();

  return useCallback(() => {
    navigation.switchTab(ETabRoutes.ReferFriends, {
      screen: ETabReferFriendsRoutes.TabPerpsReward,
    });
  }, [navigation]);
}
