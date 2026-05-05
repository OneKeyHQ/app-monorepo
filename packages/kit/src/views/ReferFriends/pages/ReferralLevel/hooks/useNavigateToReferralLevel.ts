import { useCallback } from 'react';

import { rootNavigationRef } from '@onekeyhq/components';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import {
  EModalReferFriendsRoutes,
  EModalRoutes,
  ETabReferFriendsRoutes,
  ETabRoutes,
} from '@onekeyhq/shared/src/routes';
import timerUtils from '@onekeyhq/shared/src/utils/timerUtils';

export function useNavigateToReferralLevel() {
  const navigation = useAppNavigation();

  return useCallback(async () => {
    if (platformEnv.isNative) {
      navigation.pushModal(EModalRoutes.ReferFriendsModal, {
        screen: EModalReferFriendsRoutes.ReferralLevel,
      });
    } else {
      // First switchTab may trigger a login check that redirects away,
      // so we switchTab twice to ensure we land on the ReferFriends tab.
      navigation.switchTab(ETabRoutes.ReferFriends);
      await timerUtils.wait(100);
      navigation.switchTab(ETabRoutes.ReferFriends);
      await timerUtils.wait(100);

      rootNavigationRef.current?.navigate(
        ETabReferFriendsRoutes.TabReferralLevel,
      );
    }
  }, [navigation]);
}
