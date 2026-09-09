import { useCallback } from 'react';

import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import {
  EModalReferFriendsRoutes,
  EModalRoutes,
  ETabReferFriendsRoutes,
} from '@onekeyhq/shared/src/routes';

export function useNavigateToSwapReward() {
  const navigation = useAppNavigation();

  return useCallback(() => {
    if (platformEnv.isNative) {
      navigation.pushModal(EModalRoutes.ReferFriendsModal, {
        screen: EModalReferFriendsRoutes.SwapReward,
      });
    } else {
      navigation.push(ETabReferFriendsRoutes.TabSwapReward);
    }
  }, [navigation]);
}
