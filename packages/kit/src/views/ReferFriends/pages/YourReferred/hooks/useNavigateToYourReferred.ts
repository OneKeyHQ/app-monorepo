import { useCallback } from 'react';

import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import {
  EModalReferFriendsRoutes,
  EModalRoutes,
  ETabReferFriendsRoutes,
} from '@onekeyhq/shared/src/routes';

export function useNavigateToYourReferred() {
  const navigation = useAppNavigation();

  return useCallback(() => {
    if (platformEnv.isNative) {
      // Native platform: use Modal navigation
      navigation.pushModal(EModalRoutes.ReferFriendsModal, {
        screen: EModalReferFriendsRoutes.YourReferred,
      });
    } else {
      // Web/Desktop/Extension: use Tab navigation
      navigation.push(ETabReferFriendsRoutes.TabYourReferred);
    }
  }, [navigation]);
}
