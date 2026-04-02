import { useCallback } from 'react';

import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import {
  EModalReferFriendsRoutes,
  EModalRoutes,
  ETabReferFriendsRoutes,
} from '@onekeyhq/shared/src/routes';

export function useNavigateToEarnReward() {
  const navigation = useAppNavigation();

  return useCallback(
    (title: string) => {
      if (platformEnv.isNative) {
        // Native or medium+ screens: use Modal navigation
        navigation.pushModal(EModalRoutes.ReferFriendsModal, {
          screen: EModalReferFriendsRoutes.EarnReward,
          params: { title },
        });
      } else {
        // Small screens: use Tab navigation
        navigation.push(ETabReferFriendsRoutes.TabEarnReward, { title });
      }
    },
    [navigation],
  );
}
