import { useCallback } from 'react';

import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import {
  EModalReferFriendsRoutes,
  EModalRoutes,
  ETabReferFriendsRoutes,
} from '@onekeyhq/shared/src/routes';

export function useNavigateToReferralLevel() {
  const navigation = useAppNavigation();

  return useCallback(() => {
    if (platformEnv.isNative) {
      // Native platform: use Modal navigation
      navigation.pushModal(EModalRoutes.ReferFriendsModal, {
        screen: EModalReferFriendsRoutes.ReferralLevel,
      });
    } else {
      // Web/Desktop/Extension: use Tab navigation
      navigation.push(ETabReferFriendsRoutes.TabReferralLevel);
    }
  }, [navigation]);
}
