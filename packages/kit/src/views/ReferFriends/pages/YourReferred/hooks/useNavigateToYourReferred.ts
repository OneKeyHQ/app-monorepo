import { useCallback } from 'react';

import { useIsModalPage } from '@onekeyhq/components';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import {
  EModalReferFriendsRoutes,
  EModalRoutes,
  ETabReferFriendsRoutes,
} from '@onekeyhq/shared/src/routes';

export function useNavigateToYourReferred() {
  const navigation = useAppNavigation();
  const isModalPage = useIsModalPage();

  return useCallback(() => {
    // Inside the referral modal it pushes onto that stack instead of opening
    // a second modal over the first.
    if (isModalPage) {
      navigation.push(EModalReferFriendsRoutes.YourReferred);
      return;
    }
    if (platformEnv.isNative) {
      // Native or medium+ screens: use Modal navigation
      navigation.pushModal(EModalRoutes.ReferFriendsModal, {
        screen: EModalReferFriendsRoutes.YourReferred,
      });
    } else {
      // Small screens: use Tab navigation
      navigation.push(ETabReferFriendsRoutes.TabYourReferred);
    }
  }, [isModalPage, navigation]);
}
