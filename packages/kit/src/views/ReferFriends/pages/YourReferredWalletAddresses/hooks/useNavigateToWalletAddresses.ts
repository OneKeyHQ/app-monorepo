import { useCallback } from 'react';

import { useIsModalPage } from '@onekeyhq/components';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import type { IModalReferFriendsParamList } from '@onekeyhq/shared/src/routes';
import {
  EModalReferFriendsRoutes,
  EModalRoutes,
} from '@onekeyhq/shared/src/routes';

// Inside the referral modal it pushes onto that stack instead of opening a
// second modal over the first.
export function useNavigateToWalletAddresses() {
  const navigation = useAppNavigation();
  const isModalPage = useIsModalPage();

  return useCallback(
    (
      params: IModalReferFriendsParamList[EModalReferFriendsRoutes.YourReferredWalletAddresses],
    ) => {
      if (isModalPage) {
        navigation.push(
          EModalReferFriendsRoutes.YourReferredWalletAddresses,
          params,
        );
        return;
      }
      navigation.pushModal(EModalRoutes.ReferFriendsModal, {
        screen: EModalReferFriendsRoutes.YourReferredWalletAddresses,
        params,
      });
    },
    [isModalPage, navigation],
  );
}
