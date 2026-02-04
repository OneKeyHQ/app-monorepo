import { useCallback } from 'react';

import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import {
  ETabReferFriendsRoutes,
  ETabRoutes,
} from '@onekeyhq/shared/src/routes';
import timerUtils from '@onekeyhq/shared/src/utils/timerUtils';

export function useNavigateToPerpsReward() {
  const navigation = useAppNavigation();

  return useCallback(async () => {
    navigation.switchTab(ETabRoutes.ReferFriends);
    await timerUtils.wait(50);
    navigation.push(ETabReferFriendsRoutes.TabPerpsReward);
  }, [navigation]);
}
